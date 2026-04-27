import { Router, Request, Response } from 'express';
import {
  listDocuments,
  validateFilter,
  insertDocument,
  updateDocument,
  deleteDocument,
  DocumentQuery,
} from './documentService';

const router = Router();

// GET /api/connections/:id/databases/:db/collections/:col/documents - List documents
router.get(
  '/:id/databases/:db/collections/:col/documents',
  async (req: Request, res: Response) => {
    try {
      const { id, db, col } = req.params;
      const query: DocumentQuery = {};

      if (req.query.filter) {
        query.filter = validateFilter(req.query.filter as string);
      }

      if (req.query.sort) {
        query.sort = JSON.parse(req.query.sort as string);
      }

      if (req.query.page) {
        query.page = parseInt(req.query.page as string, 10);
      }

      if (req.query.pageSize) {
        query.pageSize = parseInt(req.query.pageSize as string, 10);
      }

      const result = await listDocuments(id, db, col, query);
      res.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Invalid filter syntax')) {
        res.status(400).json({ success: false, error: message });
      } else {
        res.status(500).json({ success: false, error: message });
      }
    }
  }
);

// POST /api/connections/:id/databases/:db/collections/:col/documents - Insert document
router.post(
  '/:id/databases/:db/collections/:col/documents',
  async (req: Request, res: Response) => {
    try {
      const { id, db, col } = req.params;
      const document = req.body;

      if (typeof document !== 'object' || document === null || Array.isArray(document)) {
        throw new Error('Invalid JSON: Document must be a JSON object');
      }

      const inserted = await insertDocument(id, db, col, document);
      res.json({ success: true, data: inserted });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Invalid JSON')) {
        res.status(400).json({ success: false, error: message });
      } else {
        res.status(500).json({ success: false, error: message });
      }
    }
  }
);

// PUT /api/connections/:id/databases/:db/collections/:col/documents/:docId - Update document
router.put(
  '/:id/databases/:db/collections/:col/documents/:docId',
  async (req: Request, res: Response) => {
    try {
      const { id, db, col, docId } = req.params;
      const updates = req.body;

      if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) {
        throw new Error('Invalid JSON: Updates must be a JSON object');
      }

      const updated = await updateDocument(id, db, col, docId, updates);
      res.json({ success: true, data: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        res.status(404).json({ success: false, error: message });
      } else {
        res.status(500).json({ success: false, error: message });
      }
    }
  }
);

// DELETE /api/connections/:id/databases/:db/collections/:col/documents/:docId - Delete document
router.delete(
  '/:id/databases/:db/collections/:col/documents/:docId',
  async (req: Request, res: Response) => {
    try {
      const { id, db, col, docId } = req.params;
      await deleteDocument(id, db, col, docId);
      res.json({ success: true, message: 'Document deleted' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        res.status(404).json({ success: false, error: message });
      } else {
        res.status(500).json({ success: false, error: message });
      }
    }
  }
);

export default router;
