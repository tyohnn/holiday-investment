'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * Mount-time entrance stagger for a grid of MotionCards (./motion-card).
 * Server-rendered card content passes through as `children` untouched —
 * this only wraps the grid container to run one gsap.from() over
 * `[data-motion-card]` after hydration.
 */
export function StaggerReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const container = ref.current;
      if (!container) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const cards = container.querySelectorAll('[data-motion-card]');
        if (cards.length === 0) return;
        gsap.from(cards, {
          opacity: 0,
          y: 14,
          duration: 0.4,
          stagger: { each: 0.05, from: 'start' },
          ease: 'power2.out',
        });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
