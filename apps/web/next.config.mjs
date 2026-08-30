/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 워크스페이스 패키지(@investment/schema)는 컴파일 전 TS 소스를 export 하므로
  // Next 컴파일러가 직접 변환하도록 명시한다.
  transpilePackages: ['@investment/schema'],
  async redirects() {
    return [
      // 교재는 /docs (Fumadocs) 에서 /book (자체 리더) 으로 옮겼다.
      // 바깥에 걸린 링크가 죽지 않게 경로째로 넘긴다.
      { source: '/docs', destination: '/book', permanent: true },
      { source: '/docs/:path*', destination: '/book/:path*', permanent: true },

      // 2026-08 셸 IA: 테마(/stocks|/real-estate) 아래 섹션으로 올렸다.
      { source: '/company', destination: '/stocks/analysis', permanent: true },
      { source: '/company/:code', destination: '/stocks/analysis/:code', permanent: true },
      { source: '/company/:code/:menu', destination: '/stocks/analysis/:code/:menu', permanent: true },

      { source: '/lab/:code/filing/:rceptNo/:secNo', destination: '/stocks/analysis/:code/filing/:rceptNo/:secNo', permanent: true },
      { source: '/lab/:code/financials', destination: '/stocks/analysis/:code/primary', permanent: true },
      { source: '/lab/:code/revenue', destination: '/stocks/analysis/:code/valuation', permanent: true },
      { source: '/lab/:code/numbers', destination: '/stocks/analysis/:code/primary', permanent: true },
      { source: '/lab/:code/people', destination: '/stocks/analysis/:code/primary', permanent: true },
      { source: '/lab/:code/study', destination: '/stocks/analysis/:code/verdict', permanent: true },
      { source: '/lab/:code/agent', destination: '/stocks/analysis/:code/verdict', permanent: true },
      { source: '/lab/:code/:board', destination: '/stocks/analysis/:code/:board', permanent: true },
      { source: '/lab/:code', destination: '/stocks/analysis/:code/verdict', permanent: true },

      { source: '/industry', destination: '/stocks/macro/industries', permanent: true },
      { source: '/industry/:slug', destination: '/stocks/macro/industries/:slug', permanent: true },
    ];
  },
};

export default config;
