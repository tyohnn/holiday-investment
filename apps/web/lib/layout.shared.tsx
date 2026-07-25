import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      {
        text: '1권 기업의 가치를 계산하는 법',
        url: '/docs/book1',
        active: 'nested-url',
        on: 'nav',
      },
      {
        text: '2권 이차전지 산업을 해부하는 법',
        url: '/docs/book2',
        active: 'nested-url',
        on: 'nav',
      },
      {
        text: '종목 DB',
        url: '/docs/reference',
        active: 'nested-url',
        on: 'nav',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
