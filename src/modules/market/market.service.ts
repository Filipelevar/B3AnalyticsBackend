import type { MarketDataProvider } from './market-data-provider.js';
import { MarketDataRepository } from './market-data.repository.js';

const MAX_SYMBOLS = 10;
const MAX_RANGE_IN_DAYS = 365 * 5;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOL_PATTERN = /^[A-Z0-9]{4,8}$/;
const PERIOD_PATTERN = /^(1D|5D|1M|3M|6M|1Y)$/;

export class InvalidMarketQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMarketQueryError';
  }
}

export class HistoricalDataNotFoundError extends Error {
  constructor() {
    super('No historical data was found for the requested symbols and period.');
    this.name = 'HistoricalDataNotFoundError';
  }
}

export interface AssetHistoryQuery {
  symbols: string;
  startDate?: string;
  endDate?: string;
  range?: string;
}

export interface AssetHistoryResponse {
  data: Array<Record<string, string | number>>;
  meta?: Record<string, { name?: string; currency?: string }>;
}

export class MarketService {
  constructor(
    private readonly provider: MarketDataProvider,
    private readonly repository: MarketDataRepository,
  ) {}

  async getAssetHistory(query: AssetHistoryQuery): Promise<AssetHistoryResponse> {
    const symbols = this.parseSymbols(query.symbols);
    const { startDate, endDate } = this.resolvePeriod(query);
    const isOneDayRange = query.range === '1D' || (!query.range && !query.startDate && !query.endDate);

    if (startDate > endDate) {
      throw new InvalidMarketQueryError('startDate must be earlier than or equal to endDate.');
    }

    const rangeInDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
    if (rangeInDays > MAX_RANGE_IN_DAYS) {
      throw new InvalidMarketQueryError('The requested period cannot exceed five years.');
    }

    const exclusiveEndDate = new Date(endDate);
    exclusiveEndDate.setUTCDate(exclusiveEndDate.getUTCDate() + 1);

    const histories = await Promise.all(symbols.map(async (symbol) => {
      let result = isOneDayRange
        ? await this.provider.getHistoricalQuotes(symbol, startDate, exclusiveEndDate, '5m')
        : await this.getQuotes(symbol, startDate, exclusiveEndDate);

      if (isOneDayRange && result.meta) {
        await this.repository.saveSymbolMeta(result.meta).catch(() => {});
      }

      if (!result.meta?.name) {
        const cachedMeta = await this.repository.findSymbolMeta(symbol).catch(() => null);
        if (cachedMeta) {
          result = { ...result, meta: { ...cachedMeta, ...result.meta } };
        }
      }

      return {
        symbol,
        quotes: result.quotes,
        meta: result.meta,
      };
    }));

    const rows = new Map<string, Record<string, string | number>>();
    const metaMap: Record<string, { name?: string; currency?: string }> = {};

    for (const { symbol, quotes, meta } of histories) {
      if (meta && (meta.name || meta.currency)) {
        metaMap[symbol] = {
          ...(meta.name ? { name: meta.name } : {}),
          ...(meta.currency ? { currency: meta.currency } : {}),
        };
      }

      for (const quote of quotes) {
        const row = rows.get(quote.date) ?? { date: quote.date };
        row[symbol] = quote.close;
        rows.set(quote.date, row);
      }
    }

    const data = [...rows.values()].sort((first, second) =>
      String(first.date).localeCompare(String(second.date)),
    );

    if (data.length === 0) {
      throw new HistoricalDataNotFoundError();
    }

    return {
      data,
      ...(Object.keys(metaMap).length > 0 ? { meta: metaMap } : {}),
    };
  }

  private async getQuotes(
    symbol: string,
    startDate: Date,
    endDate: Date,
  ) {
    const hasCoverage = await this.repository.hasCoverage(symbol, startDate, endDate);

    if (hasCoverage) {
      const quotes = await this.repository.findHistoricalQuotes(symbol, startDate, endDate);
      const meta = (await this.repository.findSymbolMeta(symbol)) ?? undefined;
      return { quotes, meta };
    }

    const result = await this.provider.getHistoricalQuotes(symbol, startDate, endDate);
    await this.repository.saveHistoricalQuotes(symbol, startDate, endDate, result.quotes, result.meta);

    return result;
  }

  private resolvePeriod(query: AssetHistoryQuery): { startDate: Date; endDate: Date } {
    const hasCustomDates = Boolean(query.startDate || query.endDate);

    if (query.range && hasCustomDates) {
      throw new InvalidMarketQueryError('Use either range or startDate and endDate, not both.');
    }

    if (query.range) {
      if (!PERIOD_PATTERN.test(query.range)) {
        throw new InvalidMarketQueryError('range must be one of: 1D, 5D, 1M, 3M, 6M or 1Y.');
      }

      const endDate = this.today();
      const startDate = new Date(endDate);

      switch (query.range) {
        case '1D':
          break;
        case '5D':
          startDate.setUTCDate(startDate.getUTCDate() - 5);
          break;
        case '1M':
          this.subtractCalendarPeriod(startDate, 1, 0);
          break;
        case '3M':
          this.subtractCalendarPeriod(startDate, 3, 0);
          break;
        case '6M':
          this.subtractCalendarPeriod(startDate, 6, 0);
          break;
        case '1Y':
          this.subtractCalendarPeriod(startDate, 0, 1);
          break;
      }

      return { startDate, endDate };
    }

    if (!query.startDate || !query.endDate) {
      return this.resolvePeriod({ ...query, range: '1D' });
    }

    return {
      startDate: this.parseDate(query.startDate, 'startDate'),
      endDate: this.parseDate(query.endDate, 'endDate'),
    };
  }

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private subtractCalendarPeriod(date: Date, months: number, years: number): void {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - months);
    date.setUTCFullYear(date.getUTCFullYear() - years);

    const lastDayOfMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDayOfMonth));
  }

  private parseSymbols(value: string): string[] {
    const symbols = [...new Set(value.split(',').map((symbol) => symbol.trim().toUpperCase()))];

    if (symbols.length === 0 || symbols.some((symbol) => !SYMBOL_PATTERN.test(symbol))) {
      throw new InvalidMarketQueryError('symbols must contain valid B3 tickers separated by commas.');
    }

    if (symbols.length > MAX_SYMBOLS) {
      throw new InvalidMarketQueryError(`A maximum of ${MAX_SYMBOLS} symbols is allowed.`);
    }

    return symbols;
  }

  private parseDate(value: string, field: string): Date {
    if (!DATE_PATTERN.test(value)) {
      throw new InvalidMarketQueryError(`${field} must use the YYYY-MM-DD format.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new InvalidMarketQueryError(`${field} must be a valid date.`);
    }

    return date;
  }
}