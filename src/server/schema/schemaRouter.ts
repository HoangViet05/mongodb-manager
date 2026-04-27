import { Router, Request, Response } from 'express';
import { listDatabases, listCollections, getCollectionStats } from './schemaService';

const router = Router();

// GET /api/connections/:id/databases - List all databases
router.get('/:id/databases', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const databases = await listDatabases(id);
    res.json({ success: true, data: databases });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/connections/:id/databases/:db/collections - List all collections in a database
router.get('/:id/databases/:db/collections', async (req: Request, res: Response) => {
  try {
    const { id, db } = req.params;
    const collections = await listCollections(id, db);
    res.json({ success: true, data: collections });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/connections/:id/databases/:db/collections/:col/stats - Get collection stats
router.get('/:id/databases/:db/collections/:col/stats', async (req: Request, res: Response) => {
  try {
    const { id, db, col } = req.params;
    const stats = await getCollectionStats(id, db, col);
    res.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
