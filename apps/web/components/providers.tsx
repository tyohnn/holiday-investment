'use client';

import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // next-themes (via fumadocs RootProvider) injects an inline <script> to avoid
  // theme FOUC. React 19 warns about executable <script> tags rendered inside
  // client components. Keep a real script on the server; on the client use a
  // data-block type so React treats it as inert and skips the warning.
  const scriptProps =
    typeof window === 'undefined'
      ? undefined
      : ({ type: 'application/json' } as const);

  return (
    <RootProvider theme={{ scriptProps }}>{children}</RootProvider>
  );
}
