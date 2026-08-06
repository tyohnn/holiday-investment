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
    ];
  },
};

export default config;
