/**
 * Utilitários para tratamento, formatação e validação de CPF (Cadastro de Pessoas Físicas)
 * Utilizado como indexador principal de pacientes no Rivio Mobile.
 */

/**
 * Remove qualquer caracter não numérico do CPF.
 */
export function cleanCpf(cpf: string | undefined | null): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '').slice(0, 11);
}

/**
 * Formata um CPF completo ou parcial enquanto o usuário digita.
 * Ex: '12345678909' -> '123.456.789-09'
 */
export function formatCpf(cpf: string | undefined | null): string {
  const digits = cleanCpf(cpf);
  if (!digits) return '';

  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Validação rigorosa de CPF pelo algoritmo oficial da Receita Federal
 * (11 dígitos, não repetição trivial e dígitos verificadores J e K).
 */
export function isValidCpf(cpf: string | undefined | null): boolean {
  const clean = cleanCpf(cpf);
  if (clean.length !== 11) return false;

  // Rejeita sequências de dígitos iguais (ex: 111.111.111-11, 000.000.000-00)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.charAt(9), 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Gera um CPF matematicamente válido para testes de criação de conta
 */
export function generateValidCpf(): string {
  const digits: number[] = [];
  for (let i = 0; i < 9; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let rem = (sum * 10) % 11;
  const d1 = rem === 10 || rem === 11 ? 0 : rem;
  digits.push(d1);

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  rem = (sum * 10) % 11;
  const d2 = rem === 10 || rem === 11 ? 0 : rem;
  digits.push(d2);

  return formatCpf(digits.join(''));
}

/**
 * Mapeamento canônico de CPFs válidos indexadores para os pacientes sintéticos do Rivio
 */
export const SYNTHETIC_PATIENTS_CPFS: Record<string, { formatted: string; clean: string }> = {
  'usr-marcos-2026': {
    formatted: '123.456.789-09',
    clean: '12345678909',
  },
  'usr-camila-2026': {
    formatted: '234.567.890-92',
    clean: '23456789092',
  },
  'usr-antonio-2026': {
    formatted: '345.678.901-75',
    clean: '34567890175',
  },
  'usr-rafael-2026': {
    formatted: '456.789.012-49',
    clean: '45678901249',
  },
};

/**
 * Encontra o ID de um paciente sintético pelo CPF digitado
 */
export function findSyntheticPatientIdByCpf(input: string): string | null {
  const clean = cleanCpf(input);
  for (const [patientId, entry] of Object.entries(SYNTHETIC_PATIENTS_CPFS)) {
    if (entry.clean === clean) {
      return patientId;
    }
  }
  return null;
}
