/**
 * Production server for zkLogin Wallet
 * Serves static files and proxies API requests
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
// Configuration
const SALT_SERVER_URL = process.env.SALT_SERVER_URL || 'http://zklogin-prod-alb-1474010946.ap-northeast-2.elb.amazonaws.com';
const PROVER_URL = process.env.PROVER_URL || 'https://prover-dev.mystenlabs.com';
// Parse JSON body
app.use(express.json());
// Manual proxy for Salt Server
app.post('/api/salt', async (req, res) => {
    try {
        const response = await fetch(`${SALT_SERVER_URL}/v1/salt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });
        const data = await response.json();
        res.status(response.status).json(data);
    }
    catch (error) {
        console.error('Salt proxy error:', error);
        res.status(500).json({ error: 'Salt server proxy failed' });
    }
});
// Manual proxy for Prover
app.post('/api/prover', async (req, res) => {
    try {
        const response = await fetch(`${PROVER_URL}/v1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });
        const data = await response.json();
        res.status(response.status).json(data);
    }
    catch (error) {
        console.error('Prover proxy error:', error);
        res.status(500).json({ error: 'Prover proxy failed' });
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
});
