import type { MarketDataProvider } from './market-data-provider.js';
import { MarketDataRepository } from './market-data.repository.js';

const MAX_SYMBOLS = 10;
const MAX_RANGE_IN_DAYS = 365 * 5;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOL_PATTERN = /^[A-Z0-9]{4,8}$/;

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
  startDate: string;
  endDate: string;
}

export interface AssetHistoryResponse {
  data: Array<Record<string, string | number>>;
}

export class MarketService {
  constructor(
    private readonly provider: MarketDataProvider,
    private readonly repository: MarketDataRepository,
  ) {}

  async getAssetHistory(query: AssetHistoryQuery): Promise<AssetHistoryResponse> {
    const symbols = this.parseSymbols(query.symbols);
    const startDate = this.parseDate(query.startDate, 'startDate');
    const endDate = this.parseDate(query.endDate, 'endDate');

    if (startDate > endDate) {
      throw new InvalidMarketQueryError('startDate must be earlier than or equal to endDate.');
    }

    const rangeInDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
    if (rangeInDays > MAX_RANGE_IN_DAYS) {
      throw new InvalidMarketQueryError('The requested period cannot exceed five years.');
    }

    const exclusiveEndDate = new Date(endDate);
    exclusiveEndDate.setUTCDate(exclusiveEndDate.getUTCDate() + 1);

    const histories = await Promise.all(symbols.map(async (symbol) => ({
      symbol,
      quotes: await this.getQuotes(symbol, startDate, exclusiveEndDate),
    })));

    const rows = new Map<string, Record<string, string | number>>();

    for (const { symbol, quotes } of histories) {
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

    return { data };
  }

  private async getQuotes(symbol: string, startDate: Date, endDate: Date) {
    const hasCoverage = await this.repository.hasCoverage(symbol, startDate, endDate);

    if (hasCoverage) {
      return this.repository.findHistoricalQuotes(symbol, startDate, endDate);
    }

    const quotes = await this.provider.getHistoricalQuotes(symbol, startDate, endDate);
    await this.repository.saveHistoricalQuotes(symbol, startDate, endDate, quotes);

    return quotes;
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