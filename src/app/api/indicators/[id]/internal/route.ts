import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

const Body = z.object({
  responsible: z.string().max(200).optional(),
  contact: z.string().max(500).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const indicator = await prisma.indicator.findUnique({ where: { id }, select: { id: true } });
  if (!indicator) return NextResponse.json({ error: 'Indicador no encontrado' }, { status: 404 });
  const data = { responsible: parsed.data.responsible?.trim() ?? undefined, contact: parsed.data.contact?.trim() ?? undefined };
  const note = await prisma.internalNote.upsert({
    where: { indicatorId: id },
    update: data,
    create: { indicatorId: id, responsible: data.responsible ?? null, contact: data.contact ?? null },
  });
  return NextResponse.json({ responsible: note.responsible ?? '', contact: note.contact ?? '', updatedAt: note.updatedAt });
}
