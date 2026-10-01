import { getBoard } from '@/server/data';
import { buildWorkbook } from '@/server/export';

export const dynamic = 'force-dynamic';

export async function GET() {
  const board = await getBoard();
  const buffer = await buildWorkbook(board);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="indicadores-sismap-${date}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
