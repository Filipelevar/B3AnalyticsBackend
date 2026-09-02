import { prisma } from '../../config/prisma.js';
import type { HistoricalQuote } from './market-data-provider.js';

export class MarketDataRepository {
  async hasCoverage(symbol: string, startDate: Date, endDate: Date): Promise<boolean> {
    const coverage = await prisma.marketDataCoverage.findFirst({
      where: {
        symbol,
        startDate: { lte: startDate },
        endDate: { gte: endDate },
      },
      select: { id: true },
    });

    return coverage !== null;
  }

  async findHistoricalQuotes(
    symbol: string,
    startDate: Date,
    endDate: Date,
  ): Promise<HistoricalQuote[]> {
    const records = await prisma.marketData.findMany({
      where: {
        symbol,
        date: { gte: startDate, lt: endDate },
      },
      orderBy: { date: 'asc' },
    });

    return records.map((record) => ({
      date: record.date.toISOString().slice(0, 10),
      close: Number(record.close),
    }));
  }

  async saveHistoricalQuotes(
    symbol: string,
    startDate: Date,
    endDate: Date,
    quotes: HistoricalQuote[],
  ): Promise<void> {
    await prisma.$transaction([
      ...quotes.map((quote) =>
        prisma.marketData.upsert({
          where: {
            symbol_date: {
              symbol,
              date: new Date(`${quote.date}T00:00:00.000Z`),
            },
          },
          create: {
            symbol,
            date: new Date(`${quote.date}T00:00:00.000Z`),
            close: quote.close,
          },
          update: { close: quote.close },
        }),
      ),
      prisma.marketDataCoverage.upsert({
        where: {
          symbol_startDate_endDate: { symbol, startDate, endDate },
        },
        create: { symbol, startDate, endDate },
        update: {},
      }),
    ]);
  }
}