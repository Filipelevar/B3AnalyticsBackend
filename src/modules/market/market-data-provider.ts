export interface HistoricalQuote {
  date: string;
  close: number;
}

export interface MarketDataProvider {
  getHistoricalQuotes(
    symbol: string,
    startDate: Date,
    endDate: Date,
  ): Promise<HistoricalQuote[]>;
}