-- Políticas RLS para o Hub Rivio (Leitura e Escrita Sincronizada para o Ecossistema Mobile + Web).
do $$
declare
  t text;
begin
  foreach t in array array[
    'rivio_biomarker_definitions','rivio_patients','rivio_documents','rivio_exams',
    'rivio_wearable_daily','rivio_heart_rate_samples','rivio_alerts','rivio_medications','rivio_clinical_events'
  ] loop
    execute format('drop policy if exists demo_read_%I on %I;', t, t);
    execute format('create policy demo_read_%I on %I for select to anon, authenticated using (true);', t, t);
    execute format('drop policy if exists demo_write_%I on %I;', t, t);
    execute format('create policy demo_write_%I on %I for all to anon, authenticated using (true) with check (true);', t, t);
  end loop;
end $$;
