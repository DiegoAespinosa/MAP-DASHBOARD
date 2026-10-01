/**
 * Semilla: crea o actualiza las fuentes de SISMAP a partir de MAP_URL_1..n del .env.
 * Solo toca la tabla Source; nunca borra indicadores ni notas.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { deriveSource } from '../src/server/sismap/urls';

const envPath = path.join(process.cwd(), '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  let count = 0;
  for (let i = 1; i <= 50; i++) {
    const url = process.env[`MAP_URL_${i}`]?.trim();
    if (!url) continue;
    const name = process.env[`MAP_URL_${i}_NAME`]?.trim().replace(/^"|"$/g, '') || `Fuente ${i}`;
    const derived = deriveSource(url);
    const exportUrl = process.env[`MAP_URL_${i}_EXPORT`]?.trim() || derived?.exportUrl;
    const kind = (process.env[`MAP_URL_${i}_KIND`]?.trim() as 'CARGA_EVIDENCIA' | 'RANKING' | undefined) || derived?.kind;
    if (!exportUrl || !kind) {
      console.warn(`MAP_URL_${i}: no se reconoce la ruta; defina MAP_URL_${i}_EXPORT y MAP_URL_${i}_KIND (CARGA_EVIDENCIA | RANKING). Se omite.`);
      continue;
    }
    await prisma.source.upsert({
      where: { id: `seed-${i}` },
      update: { name, url, exportUrl, kind, sortOrder: i },
      create: { id: `seed-${i}`, name, url, exportUrl, kind, sortOrder: i },
    });
    count++;
    console.log(`fuente ${i}: ${name} (${kind})`);
  }
  console.log(`${count} fuente(s) sembradas`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
