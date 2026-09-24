import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundling these breaks Firestore writes over REST: the bundle ends up with a second copy of
  // `long`, so google-gax's toProto3JSON no longer recognises the Long values Firestore encodes
  // for integers ("don't know how to convert value 174"). Reads have none, so only writes fail.
  serverExternalPackages: ['@google-cloud/firestore', 'google-gax', 'long'],
  async headers() {
    return [
      {
        // Always revalidate the service worker script so fixes to it reach phones promptly.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
