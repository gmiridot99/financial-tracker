import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Returns the user if authenticated, null otherwise.
 *
 * Usage in API route:
 *   const user = await getAuthenticatedUser(request);
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  // Create a user-scoped client (not service role) to validate the token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return user;
}
