/** Lanza la actualización en segundo plano dentro del proceso de la app, una a la vez. */
import { prisma } from '@/server/db';
import { runRefresh, RefreshAlreadyRunning } from '@/server/refresh';

const state = globalThis as unknown as { __refreshInProgress?: boolean };

export function isRefreshInProgress(): boolean {
  return !!state.__refreshInProgress;
}

/** Crea la fila Refresh de forma síncrona (para que la UI pueda seguirla por id) y corre el resto en segundo plano. */
export async function startRefreshInBackground(): Promise<string> {
  if (state.__refreshInProgress) throw new RefreshAlreadyRunning();
  state.__refreshInProgress = true;
  let refreshId: string;
  try {
    const row = await prisma.refresh.create({ data: { status: 'RUNNING', progress: { stage: 'INICIANDO' } } });
    refreshId = row.id;
  } catch (e) {
    state.__refreshInProgress = false;
    throw e;
  }
  runRefresh({ refreshId, log: (m) => console.log(`[refresh] ${m}`) })
    .catch(async (e) => {
      console.error('[refresh] error:', e?.message ?? e);
      await prisma.refresh.update({ where: { id: refreshId }, data: { status: 'FAILED', finishedAt: new Date(), error: String(e?.message ?? e).slice(0, 500) } }).catch(() => undefined);
    })
    .finally(() => {
      state.__refreshInProgress = false;
    });
  return refreshId;
}
