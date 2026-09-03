export interface HistoricalQuote {
  date: string;
  close: number;
}

export interface SymbolMeta {
  symbol: string;
  name?: string;
  currency?: string;
}

export interface HistoricalQuoteResult {
  quotes: HistoricalQuote[];
  meta?: SymbolMeta;
}

export interface MarketDataProvider {
  getHistoricalQuotes(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval?: string,
  ): Promise<HistoricalQuoteResult>;
}