/**
 * Prefijo cuando la app se sirve bajo una sub-ruta (p. ej. `/map` detrás de nginx).
 * Vacío = raíz del dominio. Se fija en tiempo de build con NEXT_PUBLIC_BASE_PATH
 * y debe coincidir con `basePath` de next.config.ts.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');

/** Antepone el prefijo a una ruta absoluta de la app (`/api/...`, archivos de `public/`). */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
