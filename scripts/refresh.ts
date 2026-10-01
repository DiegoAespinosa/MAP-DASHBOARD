/** Actualización desde la línea de comandos: `npm run refresh` o `npm run refresh -- --dry-run`. */
import { existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

async function main() {
  const { runRefresh } = await import('../src/server/refresh');
  const dryRun = process.argv.includes('--dry-run');
  const result = await runRefresh({
    dryRun,
    log: (m) => console.log(`[refresh] ${m}`),
    onProgress: (p) => console.log(`[refresh] ${p.index}/${p.total} ${p.sourceName} · ${p.stage}`),
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'FAILED' ? 1 : 0);
}

main().catch((e) => {
  console.error('[refresh] error:', e.message ?? e);
  process.exit(1);
});
