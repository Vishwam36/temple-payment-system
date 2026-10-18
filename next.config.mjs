/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Browsers must always revalidate the push service worker so fixes roll out promptly.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
