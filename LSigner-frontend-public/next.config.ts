import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/legal/**/*': ['./src/content/legal/**/*'],
  },
};

export default nextConfig;
