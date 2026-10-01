import type { CapturedExchange } from './classify.js';
import type { SourceInput } from './config.js';
import type { AuthOutcome } from './login.js';
import type { ExportProbe } from './exports.js';

export type Accessibility = 'ACCESIBLE' | 'REQUIERE_LOGIN' | 'BLOQUEADA' | 'ERROR';
export type Rendering = 'ESTATICO' | 'DINAMICO' | 'MIXTO' | 'DESCONOCIDO';
export type Method = 'API' | 'JSON' | 'GRAPHQL' | 'DOM' | 'CUSTOM' | 'PENDIENTE';

export interface PageFacts {
  finalUrl: string;
  title: string;
  rendering: Rendering;
  frameworkHints: string[];
  initialHtmlBytes: number;
  initialTextChars: number;
  domTextChars: number;
  tables: { count: number; rows: number[]; headers: string[][] };
  embeddedJson: string[];
  forms: { count: number; methods: string[] };
  paginationHints: string[];
  iframes: string[];
  links: number;
}

export interface SourceReport {
  source: SourceInput;
  redactedUrl: string;
  startedAt: string;
  durationMs: number;
  preflight: { status?: number; location?: string; contentType?: string; error?: string };
  accessibility: Accessibility;
  auth: { outcome: AuthOutcome; summary: string; details: string[]; sessionCookieNames: string[]; bearerObserved: boolean };
  page: PageFacts;
  exchanges: CapturedExchange[];
  stats: { total: number; noise: number; json: number; graphql: number; html: number; xhrFetch: number; websockets: number };
  candidates: CapturedExchange[];
  exports: ExportProbe[];
  recommendation: { primary: Method; fallback: string; stability: 'ALTA' | 'MEDIA' | 'BAJA' | 'N/A'; extractionCase: string; rationale: string[] };
  errors: string[];
  artifactsDir: string;
}
