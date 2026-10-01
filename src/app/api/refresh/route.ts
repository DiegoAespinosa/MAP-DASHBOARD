import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { RefreshAlreadyRunning } from '@/server/refresh';
import { startRefreshInBackground } from '@/server/refresh-runner';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const running = await prisma.refresh.findFirst({ where: { status: 'RUNNING' }, select: { id: true } });
    if (running) return NextResponse.json({ error: 'Ya hay una actualización en curso.' }, { status: 409 });
    const id = await startRefreshInBackground();
    return NextResponse.json({ started: true, id }, { status: 202 });
  } catch (e) {
    if (e instanceof RefreshAlreadyRunning) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  const row = id ? await prisma.refresh.findUnique({ where: { id } }) : await prisma.refresh.findFirst({ orderBy: { startedAt: 'desc' } });
  return NextResponse.json(row ?? null);
}
