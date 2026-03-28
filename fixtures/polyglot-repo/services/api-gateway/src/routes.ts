import { Router } from 'express';
import { getAuthClient } from './grpcClient';

export const router = Router();

router.post('/auth/login', async (req, res) => {
  const client = getAuthClient();
  client.Login(req.body, (err: Error | null, response: unknown) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(response);
  });
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
