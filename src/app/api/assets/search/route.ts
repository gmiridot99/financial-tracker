import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getAuthenticatedUser } from '@/lib/api-auth';

const yahooFinance = new YahooFinance();

function mapQuoteType(quoteType: string): string {
  const typeMap: Record<string, string> = {
    EQUITY: 'stock',
    ETF: 'etf',
    MUTUALFUND: 'etf',
    BOND: 'bond',
    COMMODITY: 'commodity',
    FUTURE: 'commodity',
    INDEX: 'index',
    CRYPTOCURRENCY: 'crypto',
  };
  return typeMap[quoteType] || 'stock';
}

// Map category filter values to the Yahoo Finance quoteTypes they should match
const categoryToQuoteTypes: Record<string, string[]> = {
  stock: ['EQUITY'],
  etf: ['ETF', 'MUTUALFUND'],
  index: ['INDEX'],
  bond: ['BOND'],
  commodity: ['COMMODITY', 'FUTURE'],
  crypto: ['CRYPTOCURRENCY'],
};

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q');
  const typeFilter = request.nextUrl.searchParams.get('type');

  if (!q || q.trim().length === 0) {
    return NextResponse.json([]);
  }

  try {
    const result = await yahooFinance.search(q.trim());

    const allowedQuoteTypes = typeFilter && categoryToQuoteTypes[typeFilter]
      ? categoryToQuoteTypes[typeFilter]
      : null;

    const mapped = (result.quotes || [])
      .filter((quote): quote is Extract<typeof quote, { isYahooFinance: true }> =>
        'isYahooFinance' in quote && quote.isYahooFinance === true
      )
      .filter((quote) => {
        if (!allowedQuoteTypes) return true;
        const qt = 'quoteType' in quote ? (quote.quoteType as string) : 'EQUITY';
        return allowedQuoteTypes.includes(qt);
      })
      .slice(0, 20)
      .map((quote) => {
        const rawQuoteType = 'quoteType' in quote ? (quote.quoteType as string) : 'EQUITY';
        return {
          symbol: quote.symbol,
          name: quote.shortname || quote.longname || quote.symbol,
          type: mapQuoteType(rawQuoteType),
          exchange: quote.exchDisp || quote.exchange,
          currency: 'currency' in quote ? (quote as Record<string, unknown>).currency : undefined,
          yahooQuoteType: rawQuoteType,
        };
      });

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Yahoo Finance search error:', error);
    return NextResponse.json(
      { error: 'Errore nella ricerca' },
      { status: 500 }
    );
  }
}
