import { prisma } from '../../config/prisma.js';
import type { HistoricalQuote, SymbolMeta } from './market-data-provider.js';

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

  async findSymbolMeta(symbol: string): Promise<SymbolMeta | null> {
    const info = await prisma.symbolInfo.findUnique({
      where: { symbol },
    });

    if (!info) {
      return null;
    }

    return {
      symbol: info.symbol,
      ...(info.name ? { name: info.name } : {}),
      ...(info.currency ? { currency: info.currency } : {}),
    };
  }

  async saveSymbolMeta(meta: SymbolMeta): Promise<void> {
    await prisma.symbolInfo.upsert({
      where: { symbol: meta.symbol },
      create: {
        symbol: meta.symbol,
        name: meta.name,
        currency: meta.currency,
      },
      update: {
        ...(meta.name ? { name: meta.name } : {}),
        ...(meta.currency ? { currency: meta.currency } : {}),
      },
    });
  }

  async saveHistoricalQuotes(
    symbol: string,
    startDate: Date,
    endDate: Date,
    quotes: HistoricalQuote[],
    meta?: SymbolMeta,
  ): Promise<void> {
    await prisma.$transaction([
      ...quotes.map((quote) =>
        prisma.marketData.upsert({
          where: {
            symbol_date: {
              symbol,
              date: new Date(`${quote.date.slice(0, 10)}T00:00:00.000Z`),
            },
          },
          create: {
            symbol,
            date: new Date(`${quote.date.slice(0, 10)}T00:00:00.000Z`),
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
      ...(meta
        ? [
            prisma.symbolInfo.upsert({
              where: { symbol },
              create: {
                symbol,
                name: meta.name,
                currency: meta.currency,
              },
              update: {
                ...(meta.name ? { name: meta.name } : {}),
                ...(meta.currency ? { currency: meta.currency } : {}),
              },
            }),
          ]
        : []),
    ]);
  }
}