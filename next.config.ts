import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.beatsaver.com' },
      { protocol: 'https', hostname: 'scoresaber.com' },
      { protocol: 'https', hostname: 'new.scoresaber.com' }
    ]
  }
};

export default nextConfig;
