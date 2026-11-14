import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

function cleanCpf(cpf: string | undefined | null): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '').slice(0, 11);
}

function formatCpf(cpf: string | undefined | null): string {
  const digits = cleanCpf(cpf);
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function isValidCpf(cpf: string | undefined | null): boolean {
  const clean = cleanCpf(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawName = String(body.name || '').trim();
    const rawCpf = String(body.cpf || '').trim();
    const clean = cleanCpf(rawCpf);
    const password = String(body.password || body.pass || 'Rivio2026!').trim();

    if (!clean || clean.length !== 11) {
      return NextResponse.json(
        { error: 'O CPF é obrigatório e deve conter exatamente 11 dígitos numéricos.' },
        { status: 400 }
      );
    }

    if (!isValidCpf(clean)) {
      return NextResponse.json(
        { error: 'CPF inválido. Verifique os dígitos verificadores informados.' },
        { status: 400 }
      );
    }

    if (!rawName) {
      return NextResponse.json(
        { error: 'O nome completo do paciente é obrigatório.' },
        { status: 400 }
      );
    }

    const patientId = `usr-${clean}`;
    const formattedCpfValue = formatCpf(clean);
    const resolvedEmail = String(body.email || '').trim().toLowerCase() || `${clean}@paciente.rivio.app`;

    const patientRecord = {
      id: patientId,
      name: rawName,
      email: resolvedEmail,
      age: Number(body.age) || 35,
      biological_sex: body.biologicalSex || 'Masculino',
      city: body.city || 'São Paulo, SP',
      scenario: 'Novo Paciente Cadastrado • Indexado por CPF',
      chronic_conditions: [],
      active_medications: [],
    };

    if (!isSupabaseConfigured) {
      return NextResponse.json({
        success: true,
        patient: {
          ...patientRecord,
          cpf: formattedCpfValue,
        },
        mode: 'local',
      });
    }

    // 1. Tenta criar usuário no Supabase Auth
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.auth.admin.createUser({
          email: resolvedEmail,
          password: password.length >= 6 ? password : 'RivioPassword2026!',
          email_confirm: true,
          user_metadata: {
            name: rawName,
            cpf: formattedCpfValue,
            patientId,
          },
        });
      } else {
        await supabase.auth.signUp({
          email: resolvedEmail,
          password: password.length >= 6 ? password : 'RivioPassword2026!',
          options: {
            data: {
              name: rawName,
              cpf: formattedCpfValue,
              patientId,
            },
          },
        });
      }
    } catch (authErr: unknown) {
      console.warn('[Register API] Aviso ao criar em Supabase Auth:', authErr);
    }

    // 2. Insere na tabela rivio_patients usando permissão de serviço (ou fallback)
    const dbClient = supabaseAdmin || supabase;
    const { data: rivioData, error: rivioError } = await dbClient
      .from('rivio_patients')
      .upsert(patientRecord)
      .select()
      .maybeSingle();

    if (rivioError) {
      console.warn('[Register API] Erro ao gravar em rivio_patients:', rivioError.message);
    }

    // 3. Insere também na tabela patients se configurada
    try {
      await dbClient.from('patients').upsert({
        id: patientId,
        display_name: rawName,
        email: resolvedEmail,
        age: patientRecord.age,
        biological_sex: patientRecord.biological_sex,
        chronic_conditions: [],
      });
    } catch {
      // Ignora erro em schema alternativo
    }

    return NextResponse.json({
      success: true,
      patient: {
        id: rivioData?.id || patientId,
        name: rivioData?.name || rawName,
        email: rivioData?.email || resolvedEmail,
        cpf: formattedCpfValue,
        age: rivioData?.age || patientRecord.age,
        biologicalSex: rivioData?.biological_sex || patientRecord.biological_sex,
        city: rivioData?.city || patientRecord.city,
        scenario: rivioData?.scenario || patientRecord.scenario,
      },
      persistedInSupabase: !rivioError,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno ao cadastrar paciente.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
