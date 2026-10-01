/** Parámetros de la aplicación. Cambiar aquí; no hay panel de administración. */

/** Umbrales del semáforo en días restantes hasta el vencimiento. */
export const SEMAPHORE = {
  critical: 3, // 0-3 días
  attention: 7, // 4-7 días
  upcoming: 15, // 8-15 días
} as const;

/** Una actualización que no da señales de vida durante este tiempo se considera abandonada. */
export const REFRESH_STALE_MINUTES = 20;

/** Si una fuente devuelve menos de este porcentaje de los indicadores anteriores, no se guarda (posible fallo de extracción). */
export const ANOMALY_MIN_PERCENT = 20;

export const TIMEZONE = 'America/Santo_Domingo';

/** Colorimetría de puntuaciones (cuadros de resumen): rojo por debajo de `low`, amarillo hasta `high` inclusive, verde por encima. */
export const SCORE_BANDS = {
  low: 60,
  high: 75,
} as const;
