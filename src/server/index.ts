import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProfile, connect, parseUri } from './connections/connectionManager';

import path from 'path';
// Load .env from project root (mongo-db-manager/)
const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });
console.log('[dotenv] Loading from:', envPath, '| MONGO_URI:', process.env.MONGO_URI ? 'found' : 'not found');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'MongoDB Manager API is running' });
});

// Routers
import envRouter from './env/envRouter';
app.use('/api/env', envRouter);

import connectionRouter from './connections/connectionRouter';
app.use('/api/connections', connectionRouter);

import databaseRouter from './databases/databaseRouter';
app.use('/api/connections', databaseRouter);

import schemaRouter from './schema/schemaRouter';
app.use('/api/connections', schemaRouter);

import documentRouter from './documents/documentRouter';
app.use('/api/connections', documentRouter);

import queryRouter from './query/queryRouter';
app.use('/api/connections', queryRouter);

// All routers mounted

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal error' });
});

app.listen(PORT, async () => {
  console.log(`MongoDB Manager API running on http://localhost:${PORT}`);

  // Auto-connect from .env if MONGO_URI is set
  const mongoUri = process.env.MONGO_URI?.replace(/^["']|["']$/g, '').trim();
  if (mongoUri && (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://'))) {
    try {
      const parsed = parseUri(mongoUri);
      const profile = createProfile({
        name: 'Auto (from .env)',
        uri: mongoUri,
        host: parsed.host || 'localhost',
        port: parsed.port || 27017,
        username: parsed.username,
        password: parsed.password,
        database: parsed.database,
      });
      const state = await connect(profile.id);
      if (state.status === 'connected') {
        console.log(`[Auto-connect] Connected to MongoDB: ${parsed.host || mongoUri}`);
      } else {
        console.error(`[Auto-connect] Failed to connect: ${state.error}`);
      }
    } catch (err) {
      console.error('[Auto-connect] Error:', err instanceof Error ? err.message : err);
    }
  }
});

export default app;
