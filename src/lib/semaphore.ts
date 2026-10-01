import { SEMAPHORE } from '@/config';

export type Semaphore = 'VENCIDO' | 'CRITICO' | 'ATENCION' | 'PROXIMO' | 'NORMAL' | 'SIN_FECHA';

export function semaphoreFor(daysRemaining: number | null): Semaphore {
  if (daysRemaining === null) return 'SIN_FECHA';
  if (daysRemaining < 0) return 'VENCIDO';
  if (daysRemaining <= SEMAPHORE.critical) return 'CRITICO';
  if (daysRemaining <= SEMAPHORE.attention) return 'ATENCION';
  if (daysRemaining <= SEMAPHORE.upcoming) return 'PROXIMO';
  return 'NORMAL';
}

export const SEMAPHORE_LABEL: Record<Semaphore, string> = {
  VENCIDO: 'Vencido',
  CRITICO: 'Crítico',
  ATENCION: 'Atención',
  PROXIMO: 'Próximo',
  NORMAL: 'Normal',
  SIN_FECHA: 'Sin fecha',
};

export const SEMAPHORE_ORDER: Semaphore[] = ['VENCIDO', 'CRITICO', 'ATENCION', 'PROXIMO', 'NORMAL', 'SIN_FECHA'];
