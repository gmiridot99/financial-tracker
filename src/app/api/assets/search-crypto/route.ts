import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';

interface CoinGeckoSearchResponse {
  coins: Array<{
    id: string;
    name: string;
    symbol: string;
    thumb: string;
  }>;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q');

  if (!q || q.trim().length === 0) {
    return NextResponse.json([]);
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q.trim())}`,
      {
        headers: { 'Accept': 'application/json' },
      }
    );

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return NextResponse.json(
        { error: 'Rate limit raggiunto' },
        {
          status: 429,
          headers: retryAfter ? { 'Retry-After': retryAfter } : {},
        }
      );
    }

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }

    const data: CoinGeckoSearchResponse = await response.json();

    const mapped = (data.coins || [])
      .slice(0, 20)
      .map((coin) => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        type: 'crypto' as const,
        coingecko_id: coin.id,
        thumb: coin.thumb,
      }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('CoinGecko search error:', error);
    return NextResponse.json(
      { error: 'Errore nella ricerca crypto' },
      { status: 500 }
    );
  }
}
