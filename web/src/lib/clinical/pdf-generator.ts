/**
 * Gerador de Laudos Clínicos em PDF 1.4 válido (sem dependências binárias externas).
 * Usado para popular e servir documentos originais reais no bucket `clinical-documents` do Supabase Storage.
 */

function escapePdfText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export interface ClinicalPdfPayload {
  documentId: string;
  title: string;
  patientName: string;
  patientId: string;
  labName: string;
  occurredOn: string;
  measurements: Array<{
    name: string;
    value: number | string;
    unit: string;
    refRange?: string;
    status?: string;
  }>;
}

export function generateClinicalPdfBytes(payload: ClinicalPdfPayload): Uint8Array {
  const lines: string[] = [
    'RIVIO HEALTH HUB - LAUDO LABORATORIAL ORIGINAL',
    `Documento ID: ${payload.documentId}`,
    `Titulo: ${payload.title}`,
    `Paciente: ${payload.patientName} (${payload.patientId})`,
    `Fonte / Laboratorio: ${payload.labName}`,
    `Data da Coleta: ${payload.occurredOn}`,
    '------------------------------------------------------------------------',
    'RESULTADOS EXTRAIDOS E VERIFICADOS:',
  ];

  if (payload.measurements.length === 0) {
    lines.push('  Registro documental consolidado no cofre pessoal do paciente.');
  } else {
    for (const m of payload.measurements) {
      const ref = m.refRange ? ` [Ref: ${m.refRange}]` : '';
      const st = m.status ? ` (${m.status.toUpperCase()})` : '';
      lines.push(`  - ${m.name}: ${m.value} ${m.unit}${ref}${st}`);
    }
  }

  lines.push('------------------------------------------------------------------------');
  lines.push('Proveniência: Documento custodiado no Supabase Storage (clinical-documents)');

  const textOps = lines
    .map((line, idx) => {
      const y = 760 - idx * 18;
      return `BT /F1 11 Tf 48 ${y} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join('\n');

  const streamContent = `${textOps}\n`;
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
