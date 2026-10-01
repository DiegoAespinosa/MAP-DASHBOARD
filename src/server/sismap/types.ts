export interface ParsedEvidence {
  code: string;
  name: string;
  dueDate: Date | null;
  verifiedBy: string | null;
  value: number | null;
  status: string | null;
  externalRef: string | null;
}

export interface ParsedIndicator {
  code: string;
  name: string;
  section: string | null;
  score: number | null;
  weight: number | null;
  weightedResult: number | null;
  color: string | null;
  /** INACTIVO_TEMPORAL, SIN_DATO o null */
  status: string | null;
  subIndicadorId: string | null;
  evidences: ParsedEvidence[];
}

export interface ParsedPage {
  organismName: string | null;
  overallScore: number | null;
  sections: string[];
  indicators: ParsedIndicator[];
}

export interface ExportRow {
  code: string;
  name: string;
  score: number | null;
  weight: number | null;
  weightedResult: number | null;
}

export class SismapParseError extends Error {
  constructor(
    public readonly code: 'EXPORT_FORMAT_CHANGED' | 'EXPORT_COLUMNS_MISSING' | 'PAGE_STRUCTURE_CHANGED' | 'LOGIN_PAGE',
    message: string,
  ) {
    super(message);
    this.name = 'SismapParseError';
  }
}
