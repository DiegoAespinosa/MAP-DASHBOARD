import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Playwright y pg se cargan en tiempo de ejecucion del servidor; no deben empaquetarse.
  serverExternalPackages: ['playwright', 'playwright-core', 'pg', '@prisma/client', '@prisma/adapter-pg', 'exceljs'],
};

export default nextConfig;
