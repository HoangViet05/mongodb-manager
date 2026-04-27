import { Router, Request, Response } from 'express';
import { readEnv, writeEnv, EnvConfig } from './envService';

const router = Router();

// GET /api/env — returns current env config with password masked
router.get('/', (_req: Request, res: Response) => {
  try {
    const data = readEnv();
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// PUT /api/env — updates provided keys in .env file
router.put('/', (req: Request, res: Response) => {
  try {
    const config: Partial<EnvConfig> = req.body;
    writeEnv(config);
    res.json({ success: true, message: 'Config updated' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
