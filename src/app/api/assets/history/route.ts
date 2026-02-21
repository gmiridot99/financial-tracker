import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/api-auth';

function createSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get('symbol');
  const daysParam = request.nextUrl.searchParams.get('days');

  if (!symbol || symbol.trim() === '') {
    return NextResponse.json(
      { error: 'missing_symbol', code: 'MISSING_SYMBOL', message: 'Query parameter "symbol" is required.' },
      { status: 400 }
    );
  }

  // Default to 90 days, cap at 365
  const days = Math.min(Math.max(parseInt(daysParam ?? '90', 10) || 90, 1), 365);

  const supabaseServer = createSupabaseServer();

  // Calculate the start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().slice(0, 10);

  try {
    const { data, error } = await supabaseServer
      .from('asset_price_history')
      .select('price_date, price_eur')
      .eq('symbol', symbol.trim().toUpperCase())
      .gte('price_date', startDateStr)
      .order('price_date', { ascending: true });

    if (error) {
      console.error('Price history query error:', error);
      return NextResponse.json(
        { error: 'query_failed', message: 'Failed to fetch price history.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      history: (data ?? []).map((row) => ({
        price_date: row.price_date,
        price_eur: Number(row.price_eur),
      })),
    });
  } catch (error) {
    console.error('Price history error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
