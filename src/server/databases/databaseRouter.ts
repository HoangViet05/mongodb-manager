import { Router, Request, Response } from 'express';
import { getClient } from '../connections/connectionManager';

const router = Router();

// GET /api/connections/:id/databases - List all databases
router.get('/:id/databases', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getClient(id);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Connection not found or not connected' });
    }

    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();
    
    res.json({ success: true, data: databases });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/connections/:id/databases/:dbName/collections - List collections in a database
router.get('/:id/databases/:dbName/collections', async (req: Request, res: Response) => {
  try {
    const { id, dbName } = req.params;
    const client = getClient(id);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Connection not found or not connected' });
    }

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    
    res.json({ success: true, data: collections });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/connections/:id/databases/:dbName/collections/:collectionName/documents - Get documents from collection
router.get('/:id/databases/:dbName/collections/:collectionName/documents', async (req: Request, res: Response) => {
  try {
    const { id, dbName, collectionName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const skip = (page - 1) * pageSize;
    const filter = req.query.filter ? JSON.parse(req.query.filter as string) : {};

    const client = getClient(id);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Connection not found or not connected' });
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    const [documents, total] = await Promise.all([
      collection.find(filter).skip(skip).limit(pageSize).toArray(),
      collection.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      data: { documents, total, page, pageSize }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
