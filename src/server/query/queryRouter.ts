import { Router, Request, Response } from 'express';
import { executeQuery, QueryRequest } from './queryService';

const router = Router();

// POST /api/connections/:id/databases/:db/query - Execute custom query
router.post('/:id/databases/:db/query', async (req: Request, res: Response) => {
  try {
    const { id, db } = req.params;
    const queryRequest: QueryRequest = req.body;

    if (!queryRequest.operation || !queryRequest.collection) {
      return res.status(400).json({
        success: false,
        error: 'Operation and collection are required',
      });
    }

    const result = await executeQuery(id, db, queryRequest);

    if (result.success) {
      res.json(result);
    } else {
      if (result.error?.includes('timeout')) {
        res.status(408).json(result);
      } else {
        res.status(400).json(result);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      success: false,
      error: message,
      executionTimeMs: 0,
    });
  }
});

export default router;
