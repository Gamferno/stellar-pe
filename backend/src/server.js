import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Database from './db/db.js';

import { authRoutes } from './routes/auth.sep10.js';
import { quoteRoutes } from './routes/quote.sep38.js';
import { withdrawRoutes } from './routes/withdraw.sep24.js';
import { merchantRoutes } from './routes/merchants.js';
import { startEventListener } from './services/stellarEventListener.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Database Setup ────────────────────────────────────────────────────────────

const dbPath = process.env.DATABASE_PATH || (process.env.VERCEL ? '/tmp/stellarpe.sqlite' : './data/stellarpe.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Load and run schema
const schema = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8');
db.exec(schema);

// ─── Fastify Setup ─────────────────────────────────────────────────────────────

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' && !process.env.VERCEL
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// Plugins
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
});
await app.register(sensible);

// Attach DB to every request context
app.decorate('db', db);
app.addHook('onRequest', async (req) => { req.db = db; });

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

// API routes
await app.register(authRoutes, { prefix: '/api/sep10' });
await app.register(quoteRoutes, { prefix: '/api/sep38' });
await app.register(withdrawRoutes, { prefix: '/api/sep24' });
await app.register(merchantRoutes, { prefix: '/api/merchants' });

// ─── Start ─────────────────────────────────────────────────────────────────────

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3001', 10);

if (!process.env.VERCEL) {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`StellarPe backend listening on ${HOST}:${PORT}`);

    // Start Stellar event listener in the background
    if (process.env.CONTRACT_ID && process.env.CONTRACT_ID !== '<your deployed contract id here>') {
      startEventListener(db, app.log);
    } else {
      app.log.warn('CONTRACT_ID not set — Stellar event listener is disabled. Set it in .env to enable.');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...');
    await app.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Export Fastify handler for Vercel / serverless runtime
export default async function handler(req, res) {
  await app.ready();
  app.server.emit('request', req, res);
}

