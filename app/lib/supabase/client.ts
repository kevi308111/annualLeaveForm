import { createBrowserClient } from '@supabase/ssr';

export function createClient(accessToken?: string) { // Added accessToken parameter
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }), // Pass accessToken if provided
        },
      },
    }
  );
}
