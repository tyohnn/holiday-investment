'use client';

import { useRef, type ElementType, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { cn } from '@/lib/cn';

/**
 * Card shell with a restrained hover lift — transform + shadow only, ~200ms,
 * no bounce or scale-in (Emil Kowalski's "motion should feel like feedback,
 * not decoration" principle). Only this shell hydrates; the card content
 * passed as `children` stays server-rendered.
 *
 * `data-motion-card` is the selector StaggerReveal (./stagger-reveal) uses
 * to find cards for the mount-time entrance stagger.
 */
export function MotionCard({
  as = 'article',
  className,
  children,
  ...props
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const yTo = gsap.quickTo(el, 'y', { duration: 0.2, ease: 'power2.out' });
        const scaleTo = gsap.quickTo(el, 'scale', { duration: 0.2, ease: 'power2.out' });

        const enter = () => {
          yTo(-3);
          scaleTo(1.006);
        };
        const leave = () => {
          yTo(0);
          scaleTo(1);
        };

        el.addEventListener('pointerenter', enter);
        el.addEventListener('pointerleave', leave);
        return () => {
          el.removeEventListener('pointerenter', enter);
          el.removeEventListener('pointerleave', leave);
        };
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <Tag
      ref={ref}
      data-motion-card
      className={cn(
        'shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
