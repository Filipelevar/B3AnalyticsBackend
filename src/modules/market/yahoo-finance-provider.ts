import type {
  HistoricalQuote,
  HistoricalQuoteResult,
  MarketDataProvider,
  SymbolMeta,
} from './market-data-provider.js';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        currency?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }> | null;
  };
}

export class MarketDataProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketDataProviderError';
  }
}

export class MarketDataNotFoundProviderError extends Error {
  constructor(symbol: string) {
    super(`No market data was found for symbol ${symbol}.`);
    this.name = 'MarketDataNotFoundProviderError';
  }
}

export class YahooFinanceProvider implements MarketDataProvider {
  async getHistoricalQuotes(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval = '1d',
  ): Promise<HistoricalQuoteResult> {
    const yahooSymbol = `${symbol}.SA`;
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
    );

    const isIntraday = interval !== '1d';

    if (isIntraday) {
      url.searchParams.set('range', '1d');
      url.searchParams.set('interval', interval);
    } else {
      url.searchParams.set('period1', String(Math.floor(startDate.getTime() / 1000)));
      url.searchParams.set('period2', String(Math.floor(endDate.getTime() / 1000)));
      url.searchParams.set('interval', '1d');
      url.searchParams.set('events', 'history');
    }

    let response: Response;

    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new MarketDataProviderError('Unable to reach the market data provider.');
    }

    if (response.status === 404) {
      throw new MarketDataNotFoundProviderError(symbol);
    }

    if (!response.ok) {
      throw new MarketDataProviderError('The market data provider returned an error.');
    }

    let body: YahooChartResponse;

    try {
      body = (await response.json()) as YahooChartResponse;
    } catch {
      throw new MarketDataProviderError('The market data provider returned invalid data.');
    }

    const chart = body.chart?.result?.[0];
    const timestamps = chart?.timestamp;
    const closes = chart?.indicators?.quote?.[0]?.close;

    if (!timestamps || !closes || timestamps.length !== closes.length) {
      throw new MarketDataProviderError('The market data provider returned invalid data.');
    }

    const name = chart.meta?.longName || chart.meta?.shortName;
    const currency = chart.meta?.currency;

    const meta: SymbolMeta = {
      symbol,
      ...(name ? { name } : {}),
      ...(currency ? { currency } : {}),
    };

    const quotes = timestamps.flatMap((timestamp, index) => {
      const close = closes[index];

      if (typeof close !== 'number' || !Number.isFinite(close)) {
        return [];
      }

      const formattedDate = isIntraday
        ? new Date(timestamp * 1000).toISOString().slice(0, 16).replace('T', ' ')
        : new Date(timestamp * 1000).toISOString().slice(0, 10);

      return [{ date: formattedDate, close }];
    });

    return { quotes, meta };
  }
}