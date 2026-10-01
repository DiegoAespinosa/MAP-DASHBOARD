import { existsSync } from 'node:fs';
import path from 'node:path';

export interface SourceInput {
  index: number;
  name: string;
  slug: string;
  url: string;
}

export interface ReconConfig {
  rootDir: string;
  outDir: string;
  sources: SourceInput[];
  username?: string;
  password?: string;
  loginUrl?: string;
  autoLogin: boolean;
  headless: boolean;
  interactiveSeconds: number;
  storageStatePath: string;
  navTimeoutMs: number;
  maxBodyBytes: number;
  /** undefined = Chromium de Playwright; 'chrome' | 'msedge' = navegador del sistema. */
  browserChannel?: 'chrome' | 'msedge';
}

const MAX_SOURCES = 50;

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'fuente'
  );
}

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined || v === '') return def;
  return /^(1|true|yes|si)$/i.test(v.trim());
}

function num(v: string | undefined, def: number): number {
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function channel(v: string | undefined): 'chrome' | 'msedge' | undefined {
  const c = v?.trim().toLowerCase();
  return c === 'chrome' || c === 'msedge' ? c : undefined;
}

/** Carga .env desde la raiz del repo (Node >= 20.12 trae process.loadEnvFile). */
export function loadEnvFile(rootDir: string): void {
  const envPath = path.join(rootDir, '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

export function loadConfig(rootDir: string): ReconConfig {
  loadEnvFile(rootDir);
  const env = process.env;

  const sources: SourceInput[] = [];
  for (let i = 1; i <= MAX_SOURCES; i++) {
    const url = env[`MAP_URL_${i}`]?.trim();
    if (!url) continue;
    const name = env[`MAP_URL_${i}_NAME`]?.trim() || `MAP fuente ${i}`;
    sources.push({ index: i, name, slug: `${String(i).padStart(2, '0')}-${slugify(name)}`, url });
  }

  const storage = env.MAP_STORAGE_STATE?.trim() || './.secrets/map.storage-state.json';

  return {
    rootDir,
    outDir: path.resolve(rootDir, env.MAP_RECON_OUT_DIR?.trim() || 'docs/recon'),
    sources,
    username: env.MAP_USERNAME?.trim() || undefined,
    password: env.MAP_PASSWORD || undefined,
    loginUrl: env.MAP_LOGIN_URL?.trim() || undefined,
    autoLogin: bool(env.MAP_RECON_AUTO_LOGIN, false),
    headless: bool(env.MAP_RECON_HEADLESS, true),
    interactiveSeconds: num(env.MAP_RECON_INTERACTIVE_SECONDS, 0),
    storageStatePath: path.resolve(rootDir, storage),
    navTimeoutMs: num(env.MAP_RECON_NAV_TIMEOUT_MS, 45_000),
    maxBodyBytes: num(env.MAP_RECON_MAX_BODY_BYTES, 2_000_000),
    browserChannel: channel(env.MAP_RECON_BROWSER_CHANNEL),
  };
}

export function validateSources(cfg: ReconConfig): string[] {
  const problems: string[] = [];
  if (cfg.sources.length === 0) {
    problems.push('No hay MAP_URL_n definidas en .env (ver .env.example).');
  }
  for (const s of cfg.sources) {
    try {
      const u = new URL(s.url);
      if (!/^https?:$/.test(u.protocol)) problems.push(`MAP_URL_${s.index}: protocolo no soportado (${u.protocol}).`);
    } catch {
      problems.push(`MAP_URL_${s.index}: URL invalida "${s.url}".`);
    }
  }
  return problems;
}
