/**
 * Production server for zkLogin Wallet
 * Serves static files and proxies API requests
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration
const SALT_SERVER_URL = process.env.SALT_SERVER_URL || 'http://zklogin-prod-alb-1474010946.ap-northeast-2.elb.amazonaws.com';
const PROVER_URL = process.env.PROVER_URL || 'https://prover-dev.mystenlabs.com';
const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.devnet.sui.io';
const SPONSOR_PRIVATE_KEY = process.env.SPONSOR_PRIVATE_KEY || '';
const SPONSORED_TX_ENABLED = process.env.SPONSORED_TX_ENABLED !== 'false' && SPONSOR_PRIVATE_KEY.length > 0;

const sponsorClient = new SuiClient({ url: SUI_RPC_URL });
const sponsorKeypair = SPONSORED_TX_ENABLED
  ? Ed25519Keypair.fromSecretKey(SPONSOR_PRIVATE_KEY)
  : null;
const sponsorAddress = sponsorKeypair?.toSuiAddress() || null;

// Parse JSON body
app.use(express.json());

// Manual proxy for Salt Server
app.post('/api/salt', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${SALT_SERVER_URL}/v1/salt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Salt proxy error:', error);
    res.status(500).json({ error: 'Salt server proxy failed' });
  }
});

// Manual proxy for Prover
app.post('/api/prover', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${PROVER_URL}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Prover proxy error:', error);
    res.status(500).json({ error: 'Prover proxy failed' });
  }
});

// Sponsor info for client-side transaction build
app.get('/api/sponsor/info', (_req: Request, res: Response) => {
  if (!SPONSORED_TX_ENABLED || !sponsorAddress) {
    return res.status(503).json({
      enabled: false,
      error: 'Sponsored transaction is disabled. Set SPONSOR_PRIVATE_KEY on server.',
    });
  }

  return res.json({
    enabled: true,
    sponsorAddress,
  });
});

// Sponsor execution endpoint
app.post('/api/sponsor/execute', async (req: Request, res: Response) => {
  if (!SPONSORED_TX_ENABLED || !sponsorKeypair || !sponsorAddress) {
    return res.status(503).json({
      error: 'Sponsored transaction is disabled. Set SPONSOR_PRIVATE_KEY on server.',
    });
  }

  try {
    const { transactionBlock, userSignature } = req.body ?? {};

    if (typeof transactionBlock !== 'string' || transactionBlock.length === 0) {
      return res.status(400).json({ error: 'transactionBlock is required (base64 string)' });
    }

    if (typeof userSignature !== 'string' || userSignature.length === 0) {
      return res.status(400).json({ error: 'userSignature is required' });
    }

    const txBytes = Uint8Array.from(Buffer.from(transactionBlock, 'base64'));
    const { signature: sponsorSignature } = await sponsorKeypair.signTransaction(txBytes);

    const result = await sponsorClient.executeTransactionBlock({
      transactionBlock,
      signature: [userSignature, sponsorSignature],
      options: {
        showEffects: true,
      },
      requestType: 'WaitForLocalExecution',
    });

    if (result.effects?.status?.status !== 'success') {
      return res.status(400).json({
        error: result.effects?.status?.error || 'Sponsored transaction failed',
      });
    }

    return res.json({
      digest: result.digest,
      status: result.effects?.status?.status,
      sponsorAddress,
    });
  } catch (error) {
    console.error('Sponsor execute error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Sponsored execution failed',
    });
  }
});

// Serve static files from dist
app.use(express.static(path.join(__dirname, '../dist')));

// SPA fallback - serve index.html for all other routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 zkLogin Wallet server running on port ${PORT}`);
  console.log(`   Static files: ${path.join(__dirname, '../dist')}`);
  console.log(`   Salt Server: ${SALT_SERVER_URL}`);
  console.log(`   Prover: ${PROVER_URL}`);
  console.log(`   RPC: ${SUI_RPC_URL}`);
  console.log(`   Sponsored TX: ${SPONSORED_TX_ENABLED ? 'enabled' : 'disabled'}`);
  if (sponsorAddress) {
    console.log(`   Sponsor Address: ${sponsorAddress}`);
  }
});
