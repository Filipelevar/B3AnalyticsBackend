import type { FastifyInstance } from 'fastify';

import {
  HistoricalDataNotFoundError,
  InvalidMarketQueryError,
  MarketService,
} from './market.service.js';
import { MarketDataRepository } from './market-data.repository.js';
import {
  MarketDataNotFoundProviderError,
  MarketDataProviderError,
  YahooFinanceProvider,
} from './yahoo-finance-provider.js';

interface AssetHistoryQuerystring {
  symbols?: string;
  startDate?: string;
  endDate?: string;
}

const marketService = new MarketService(
  new YahooFinanceProvider(),
  new MarketDataRepository(),
);

export async function registerMarketRoutes(server: FastifyInstance): Promise<void> {
  server.get<{ Querystring: AssetHistoryQuerystring }>('/assets/history', async (request, reply) => {
    const { symbols, startDate, endDate } = request.query;

    if (!symbols || !startDate || !endDate) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'symbols, startDate and endDate are required.',
      });
    }

    try {
      return await marketService.getAssetHistory({ symbols, startDate, endDate });
    } catch (error) {
      if (error instanceof InvalidMarketQueryError) {
        return reply.status(400).send({ error: 'Bad Request', message: error.message });
      }

      if (error instanceof HistoricalDataNotFoundError) {
        return reply.status(404).send({ error: 'Not Found', message: error.message });
      }

      if (error instanceof MarketDataNotFoundProviderError) {
        return reply.status(404).send({ error: 'Not Found', message: error.message });
      }

      if (error instanceof MarketDataProviderError) {
        return reply.status(502).send({ error: 'Bad Gateway', message: error.message });
      }

      request.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.',
      });
    }
  });
}