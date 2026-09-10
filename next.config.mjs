import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Datos de build para mostrar la versión en el footer.
 * Se resuelven una sola vez, al compilar (funciona en local y en Vercel).
 */
function buildInfo() {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
  const version = pkg.version ?? '0.0.0';

  const git = (cmd, fallback = '') => {
    try {
      return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return fallback;
    }
  };

  // Hora local del último commit tal como quedó registrada (HH:MM).
  const commitTime = git('git log -1 --date=format:%H:%M --format=%cd', '');
  const commitDate = git('git log -1 --date=format:%Y-%m-%d --format=%cd', '');
  const commitSha =
    git('git rev-parse --short HEAD', '') ||
    (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);

  return { version, commitTime, commitDate, commitSha };
}

const info = buildInfo();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js se distribuye como ESM; Next lo transpila para el bundle del server.
  transpilePackages: ['three'],
  env: {
    NEXT_PUBLIC_APP_VERSION: info.version,
    NEXT_PUBLIC_COMMIT_TIME: info.commitTime,
    NEXT_PUBLIC_COMMIT_DATE: info.commitDate,
    NEXT_PUBLIC_COMMIT_SHA: info.commitSha,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
    ],
  },
};

export default nextConfig;
