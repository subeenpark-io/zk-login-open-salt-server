/**
 * Express 백엔드 서버
 *
 * zkLogin Salt Server SDK를 사용하여 /api/zklogin/salt 엔드포인트를 제공합니다.
 */

import express from 'express';
import cors from 'cors';
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';

const app = express();

// CORS 설정 (프론트엔드 허용)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// zkLogin Salt 엔드포인트
// POST /api/zklogin/salt with { "jwt": "..." }
const saltRouter = await createSaltRouter({
  provider: {
    type: process.env.SALT_PROVIDER_TYPE as any || 'mysten',
    seed: process.env.MASTER_SEED,
    endpoint: process.env.SALT_ENDPOINT
  } as any
});

app.use('/api/zklogin', saltRouter);

// 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'internal_server_error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📍 Salt endpoint: http://localhost:${PORT}/api/zklogin/salt`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});
