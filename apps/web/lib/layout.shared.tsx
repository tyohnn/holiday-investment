import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      {
        text: '교재① 방법론',
        url: '/docs/book1',
        active: 'nested-url',
      },
      {
        text: '교재② 이차전지',
        url: '/docs/book2',
        active: 'nested-url',
      },
      {
        text: '자료',
        url: '/docs/reference',
        active: 'nested-url',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
