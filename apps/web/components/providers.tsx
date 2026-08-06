'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * Dark mode. `attribute="class"` matches the `.dark` selector the shadcn theme
 * tokens and the `@custom-variant dark` in global.css are written against.
 *
 * next-themes injects an inline <script> to avoid a theme flash. React 19 warns
 * about executable <script> tags rendered from client components, so keep a real
 * script on the server and hand the client an inert type instead.
 */
export function Providers({ children }: { children: ReactNode }) {
  const scriptProps =
    typeof window === 'undefined' ? undefined : ({ type: 'application/json' } as const);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={scriptProps}
    >
      {children}
    </ThemeProvider>
  );
}
