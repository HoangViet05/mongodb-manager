import { Router, Request, Response } from 'express';
import {
  createProfile,
  listProfiles,
  deleteProfile,
  connect,
  disconnect,
  getStatus,
  ConnectionProfile,
} from './connectionManager';

const router = Router();

// POST /api/connections - Create new connection profile
router.post('/', (req: Request, res: Response) => {
  try {
    const data: Omit<ConnectionProfile, 'id' | 'createdAt'> = req.body;
    const profile = createProfile(data);
    const { password, ...profileWithoutPassword } = profile;
    res.json({ success: true, data: profileWithoutPassword });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/connections - List all connection profiles
router.get('/', (_req: Request, res: Response) => {
  try {
    const profiles = listProfiles();
    res.json({ success: true, data: profiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/connections/:id/connect - Connect to MongoDB
router.post('/:id/connect', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const state = await connect(id);
    res.json({
      success: true,
      data: {
        status: state.status,
        error: state.error,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({ success: false, error: `Connection failed: ${message}` });
  }
});

// POST /api/connections/:id/disconnect - Disconnect from MongoDB
router.post('/:id/disconnect', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await disconnect(id);
    res.json({ success: true, message: 'Disconnected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/connections/:id/status - Get connection status
router.get('/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const status = getStatus(id);
    res.json({ success: true, data: status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(404).json({ success: false, error: message });
  }
});

// DELETE /api/connections/:id - Delete connection profile
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    deleteProfile(id);
    res.json({ success: true, message: 'Profile deleted' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
