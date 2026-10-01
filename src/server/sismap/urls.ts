/** Deduce el tipo de fuente y la URL de "Descargar Datos" a partir de la URL de la página de SISMAP. */
export function deriveSource(pageUrl: string): { kind: 'CARGA_EVIDENCIA' | 'RANKING'; exportUrl: string } | null {
  const u = new URL(pageUrl);
  const p = u.pathname;
  let m: RegExpExecArray | null;
  if ((m = /^(.*)\/CargaEvidencia\/Index\/(\d+)/i.exec(p))) return { kind: 'CARGA_EVIDENCIA', exportUrl: `${u.origin}${m[1]}/CargaEvidencia/ExportarDatos/${m[2]}` };
  if ((m = /^(.*)\/CargaEvidencia\/PoliticasTransversales\/(\d+)/i.exec(p))) return { kind: 'CARGA_EVIDENCIA', exportUrl: `${u.origin}${m[1]}/CargaEvidencia/ExportarDatosTransversales/${m[2]}` };
  if ((m = /^(.*)\/CargaEvidenciaEdi\/Index\/(\d+)/i.exec(p))) return { kind: 'CARGA_EVIDENCIA', exportUrl: `${u.origin}${m[1]}/CargaEvidenciaEdi/ExportarDatos/${m[2]}` };
  if ((m = /^(.*)\/Ranking\/InformeAnualEdiView/i.exec(p))) return { kind: 'RANKING', exportUrl: `${u.origin}${m[1]}/Ranking/ExportarEdi` };
  return null;
}
