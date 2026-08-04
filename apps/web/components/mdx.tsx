import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { TextbookChart } from '@/components/charts/textbook/textbook-chart';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    TextbookChart,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
