import type { NextConfig } from 'next';

// Sub-ruta opcional (p. ej. `/map` detrás de nginx). Vacío = raíz. Se fija al compilar.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  basePath,
  // Playwright y pg se cargan en tiempo de ejecucion del servidor; no deben empaquetarse.
  serverExternalPackages: ['playwright', 'playwright-core', 'pg', '@prisma/client', '@prisma/adapter-pg', 'exceljs'],
};

export default nextConfig;
