import 'dotenv/config';

import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import Fastify from 'fastify';

import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerMarketRoutes } from './modules/market/market.routes.js';

const port = Number(process.env.PORT ?? 3333);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const jwtSecret = process.env.JWT_SECRET;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.');
}

const server = Fastify({ logger: true });

server.get('/health', async () => ({
  status: 'ok',
  message: 'B3 Analytics API is running',
}));

async function start(): Promise<void> {
  await server.register(cors, {
    origin: corsOrigin,
  });
  await server.register(jwt, { secret: jwtSecret! });
  await registerAuthRoutes(server);
  await registerMarketRoutes(server);

  try {
    await server.listen({ host: '0.0.0.0', port });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

void start();