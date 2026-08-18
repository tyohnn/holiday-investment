'use client';

import { createContext, useContext } from 'react';

export const StoryNavContext = createContext<{
  focusId: string;
  go: (id: string) => void;
}>({
  focusId: 'overview',
  go: () => {},
});

export function useStoryNav() {
  return useContext(StoryNavContext);
}
