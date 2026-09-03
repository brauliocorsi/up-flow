do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
  end loop;

  -- funções internas de gatilho / manutenção: sem execução por utilizadores
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('rc_fn_novo_reporte','rc_fn_log_estado','rc_fn_bloqueia_estado',
                         'rc_fn_nok_gera_reporte','rc_gerar_execucoes','rc_marcar_em_falta',
                         'rc_processar_escalonamentos','rc_manutencao_horaria')
  loop
    execute format('revoke all on function %s from authenticated', f.sig);
  end loop;
end $$;