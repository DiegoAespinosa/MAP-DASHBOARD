import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Carga .env (Node >= 20.12) para que la CLI de Prisma vea DATABASE_URL sin dependencias extra.
const envPath = path.join(process.cwd(), '.env');
if (existsSync(envPath) && !process.env.DATABASE_URL) process.loadEnvFile(envPath);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/map_dashboard',
  },
});
