import ExcelJS from 'exceljs';
import { SEMAPHORE_LABEL } from '@/lib/semaphore';
import type { Board } from '@/server/data';

const fmtDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** Libro Excel con dos hojas: Indicadores y Evidencias. */
export async function buildWorkbook(board: Board): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MAP-DASHBOARD';
  wb.created = new Date();

  const ind = wb.addWorksheet('Indicadores');
  ind.columns = [
    { header: 'Fuente', key: 'source', width: 24 },
    { header: 'Código', key: 'code', width: 10 },
    { header: 'Indicador', key: 'name', width: 60 },
    { header: 'Sección', key: 'section', width: 40 },
    { header: 'Puntuación', key: 'score', width: 12 },
    { header: 'Peso', key: 'weight', width: 10 },
    { header: 'Resultado', key: 'result', width: 12 },
    { header: 'Color SISMAP', key: 'color', width: 14 },
    { header: 'Estado SISMAP', key: 'status', width: 16 },
    { header: 'Próximo vencimiento', key: 'deadline', width: 18 },
    { header: 'Días restantes', key: 'days', width: 14 },
    { header: 'Semáforo', key: 'semaphore', width: 12 },
    { header: 'Evidencias vencidas', key: 'overdue', width: 18 },
    { header: 'Evidencias total', key: 'total', width: 16 },
    { header: 'Responsable', key: 'responsible', width: 24 },
    { header: 'Contacto', key: 'contact', width: 32 },
  ];
  for (const i of board.indicators) {
    if (i.missing) continue;
    ind.addRow({
      source: i.sourceName,
      code: i.code,
      name: i.name,
      section: i.section ?? '',
      score: i.score ?? '',
      weight: i.weight ?? '',
      result: i.weightedResult ?? '',
      color: i.color ?? '',
      status: i.status ?? '',
      deadline: fmtDate(i.deadline),
      days: i.daysRemaining ?? '',
      semaphore: SEMAPHORE_LABEL[i.semaphore],
      overdue: i.evidencesOverdue,
      total: i.evidencesTotal,
      responsible: i.responsible,
      contact: i.contact,
    });
  }

  const ev = wb.addWorksheet('Evidencias');
  ev.columns = [
    { header: 'Fuente', key: 'source', width: 24 },
    { header: 'Código indicador', key: 'icode', width: 16 },
    { header: 'Indicador', key: 'iname', width: 50 },
    { header: 'Código evidencia', key: 'code', width: 16 },
    { header: 'Evidencia', key: 'name', width: 60 },
    { header: 'Vencimiento', key: 'due', width: 14 },
    { header: 'Verificado por', key: 'verifiedBy', width: 24 },
    { header: 'Valor', key: 'value', width: 10 },
    { header: 'Estado', key: 'status', width: 14 },
  ];
  for (const i of board.indicators) {
    if (i.missing) continue;
    for (const e of i.evidences) {
      if (e.missing) continue;
      ev.addRow({ source: i.sourceName, icode: i.code, iname: i.name, code: e.code, name: e.name, due: fmtDate(e.dueDate), verifiedBy: e.verifiedBy ?? '', value: e.value ?? '', status: e.status ?? (e.overdue ? 'Vencido' : '') });
    }
  }

  for (const ws of [ind, ev]) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
