/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js se distribuye como ESM; Next lo transpila para el bundle del server.
  transpilePackages: ['three'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
    ],
  },
};

export default nextConfig;
