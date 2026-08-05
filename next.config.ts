import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * PGlite는 WASM과 데이터 파일을 런타임에 자기 경로 기준으로 찾는다.
   * 번들러가 건드리면 그 경로가 깨져 "path argument ... Received an instance of URL"이 난다.
   * API route(node 조건)에서는 통과하고 서버 컴포넌트(react-server 조건)에서만 터져
   * 원인이 잘 보이지 않는다.
   */
  serverExternalPackages: ['@electric-sql/pglite'],
}

export default nextConfig
