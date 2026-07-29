import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      {
        text: '2권 이차전지 산업을 해부하는 법',
        url: '/docs/book2',
        active: 'nested-url',
      },
      {
        text: '자료',
        url: '/docs/reference',
        active: 'nested-url',
      },
      {
        text: '종목 분석',
        url: '/company',
        active: 'nested-url',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
