'use client';

import { useEffect, useState } from 'react';

/**
 * Hairline progress bar across the bottom of the reader header — how far into
 * this chapter you are. A book gives you that for free by thickness; a screen
 * has to say it.
 */
export function ReadingProgress() {
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setRatio(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-px origin-left bg-primary transition-transform duration-150 ease-out"
      style={{ transform: `scaleX(${ratio})` }}
    />
  );
}
