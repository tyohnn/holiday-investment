import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 워크스페이스 패키지(@investment/schema)는 컴파일 전 TS 소스를 export 하므로
  // Next 컴파일러가 직접 변환하도록 명시한다.
  transpilePackages: ['@investment/schema'],
};

export default withMDX(config);
