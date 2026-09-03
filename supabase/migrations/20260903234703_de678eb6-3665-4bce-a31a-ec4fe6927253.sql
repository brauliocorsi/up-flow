-- lovable-cron-fallback-reviewed: 25 runs/day; prazos em horas úteis exigem verificação horária consolidada (checklists em falta + escalonamento) mais uma geração diária de checklists

create extension if not exists pg_cron;

-- 1. ALTERAÇÕES ÀS TABELAS EXISTENTES
alter table public.funcoes
  add column if not exists prefixo text,
  add column if not exists cor     text,
  add column if not exists ativo   boolean not null default true;

update public.funcoes set prefixo = upper(left(regexp_replace(nome, '[^a-zA-Z]', '', 'g'), 3))
 where prefixo is null;

alter table public.funcionario_setores
  add column if not exists responsavel boolean not null default false;

-- 2. CONFIGURAÇÃO E CALENDÁRIO ÚTIL
create table if not exists public.rc_config (
  chave text primary key,
  valor text not null
);
grant select on public.rc_config to authenticated;
grant all on public.rc_config to service_role;
alter table public.rc_config enable row level security;

insert into public.rc_config (chave, valor) values
  ('horas_resposta',  '24'),
  ('horas_resolucao', '24'),
  ('sabado_e_util',   'false')
on conflict (chave) do nothing;

create table if not exists public.feriados (
  data      date primary key,
  descricao text not null
);
grant select on public.feriados to authenticated;
grant all on public.feriados to service_role;
alter table public.feriados enable row level security;

insert into public.feriados (data, descricao) values
  ('2026-01-01','Ano Novo'), ('2026-04-03','Sexta-feira Santa'),
  ('2026-04-05','Páscoa'),   ('2026-04-25','Dia da Liberdade'),
  ('2026-05-01','Dia do Trabalhador'), ('2026-06-04','Corpo de Deus'),
  ('2026-06-10','Dia de Portugal'),    ('2026-08-15','Assunção'),
  ('2026-10-05','Implantação da República'), ('2026-11-01','Todos os Santos'),
  ('2026-12-01','Restauração da Independência'), ('2026-12-08','Imaculada Conceição'),
  ('2026-12-25','Natal')
on conflict do nothing;

create or replace function public.rc_cfg(p_chave text, p_default text)
returns text language sql stable set search_path = public as $$
  select coalesce((select valor from public.rc_config where chave = p_chave), p_default)
$$;

create or replace function public.rc_e_dia_util(p_data date)
returns boolean language sql stable set search_path = public as $$
  select case
    when extract(isodow from p_data) = 7 then false
    when extract(isodow from p_data) = 6 then public.rc_cfg('sabado_e_util','false') = 'true'
    else true
  end and not exists (select 1 from public.feriados where data = p_data)
$$;

create or replace function public.rc_add_horas_uteis(p_inicio timestamptz, p_horas int)
returns timestamptz language plpgsql stable set search_path = public as $$
declare v_ts timestamptz := p_inicio; v_restam int := p_horas;
begin
  while not public.rc_e_dia_util(v_ts::date) loop
    v_ts := date_trunc('day', v_ts) + interval '1 day';
  end loop;
  while v_restam > 0 loop
    v_ts := v_ts + interval '1 hour';
    if public.rc_e_dia_util(v_ts::date) then v_restam := v_restam - 1; end if;
  end loop;
  return v_ts;
end $$;

create or replace function public.rc_horas_uteis_entre(p_ini timestamptz, p_fim timestamptz)
returns numeric language sql stable set search_path = public as $$
  select coalesce(count(*), 0)::numeric
    from generate_series(date_trunc('hour', p_ini), p_fim, interval '1 hour') h
   where public.rc_e_dia_util(h::date)
$$;

-- 3. HELPERS DE PERMISSÃO
create or replace function public.rc_meu_funcionario_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.funcionarios where user_id = auth.uid() and ativo
$$;

create or replace function public.rc_e_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'gestor' from public.funcionarios
                    where user_id = auth.uid() and ativo), false)
$$;

create or replace function public.rc_meus_setores() returns setof uuid
language sql stable security definer set search_path = public as $$
  select fs.funcao_id from public.funcionario_setores fs
    join public.funcionarios f on f.id = fs.funcionario_id
   where f.user_id = auth.uid() and f.ativo
  union
  select f.funcao_id from public.funcionarios f
   where f.user_id = auth.uid() and f.ativo and f.funcao_id is not null
$$;

create or replace function public.rc_pertence_setor(p_setor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rc_e_gestor() or p_setor in (select public.rc_meus_setores())
$$;

create or replace function public.rc_e_responsavel(p_setor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rc_e_gestor() or exists (
    select 1 from public.funcionario_setores fs join public.funcionarios f on f.id = fs.funcionario_id
     where f.user_id = auth.uid() and f.ativo
       and fs.funcao_id = p_setor and fs.responsavel)
$$;

-- 4. REPORTES DE ERRO
create table public.reporte_contadores (
  setor_id uuid not null references public.funcoes(id) on delete cascade,
  ano      int  not null,
  ultimo   int  not null default 0,
  primary key (setor_id, ano)
);
grant select on public.reporte_contadores to authenticated;
grant all on public.reporte_contadores to service_role;
alter table public.reporte_contadores enable row level security;
create policy rc_sel_contadores on public.reporte_contadores for select to authenticated using (true);

create table public.reportes (
  id                 uuid primary key default gen_random_uuid(),
  numero             text unique,
  titulo             text not null,
  descricao          text not null,
  setor_origem_id    uuid references public.funcoes(id) on delete set null,
  setor_destino_id   uuid not null references public.funcoes(id) on delete restrict,
  reportado_por      uuid not null references public.funcionarios(id) on delete restrict,
  estado             text not null default 'pendente',
  gravidade          text not null default 'media',
  anexos             text[] not null default '{}',
  prazo_resposta     timestamptz,
  prazo_resolucao    timestamptz,
  respondido_em      timestamptz,
  assumido_por       uuid references public.funcionarios(id) on delete set null,
  data_prevista      date,
  contestado_em      timestamptz,
  escalado_resposta  boolean not null default false,
  escalado_resolucao boolean not null default false,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  fechado_em         timestamptz,
  constraint reportes_estado_chk check (estado = any (array
    ['pendente','a_tratar','corrigido','validado','nao_procede'])),
  constraint reportes_gravidade_chk check (gravidade = any (array
    ['baixa','media','alta']))
);
grant select, insert, update on public.reportes to authenticated;
grant all on public.reportes to service_role;
create index on public.reportes (setor_destino_id, estado);
create index on public.reportes (criado_em desc);
create index on public.reportes (prazo_resposta)  where respondido_em is null;
create index on public.reportes (prazo_resolucao) where fechado_em is null;

create table public.reporte_eventos (
  id              uuid primary key default gen_random_uuid(),
  reporte_id      uuid not null references public.reportes(id) on delete cascade,
  autor_id        uuid not null references public.funcionarios(id) on delete restrict,
  tipo            text not null default 'comentario',
  texto           text,
  anexos          text[] not null default '{}',
  estado_anterior text,
  estado_novo     text,
  criado_em       timestamptz not null default now(),
  constraint reporte_eventos_tipo_chk check (tipo = any (array
    ['comentario','mudanca_estado','anexo','decisao','contestacao','reclassificacao']))
);
grant select, insert on public.reporte_eventos to authenticated;
grant all on public.reporte_eventos to service_role;
create index on public.reporte_eventos (reporte_id, criado_em);

create or replace function public.rc_fn_novo_reporte() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ano int := extract(year from now()); v_seq int; v_prefixo text;
begin
  if new.numero is null then
    insert into public.reporte_contadores (setor_id, ano, ultimo)
    values (new.setor_destino_id, v_ano, 1)
    on conflict (setor_id, ano) do update set ultimo = public.reporte_contadores.ultimo + 1
    returning ultimo into v_seq;
    select coalesce(prefixo,'REP') into v_prefixo from public.funcoes where id = new.setor_destino_id;
    new.numero := v_prefixo || '-' || v_ano || '-' || lpad(v_seq::text, 3, '0');
  end if;
  new.prazo_resposta := public.rc_add_horas_uteis(now(), public.rc_cfg('horas_resposta','24')::int);
  return new;
end $$;

create trigger trg_rc_novo_reporte before insert on public.reportes
for each row execute function public.rc_fn_novo_reporte();

create or replace function public.rc_fn_log_estado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.reporte_eventos (reporte_id, autor_id, tipo, estado_anterior, estado_novo)
    values (new.id, coalesce(public.rc_meu_funcionario_id(), old.reportado_por),
            'mudanca_estado', old.estado, new.estado);
    new.fechado_em := case when new.estado in ('validado','nao_procede') then now() end;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

create trigger trg_rc_log_estado before update on public.reportes
for each row execute function public.rc_fn_log_estado();

create or replace function public.rc_fn_bloqueia_estado() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado is distinct from old.estado
     and coalesce(current_setting('app.rc_transicao', true), '') <> '1' then
    raise exception 'Mudança de estado só é permitida via rc_mudar_estado()';
  end if;
  return new;
end $$;

create trigger trg_rc_bloqueia_estado before update on public.reportes
for each row execute function public.rc_fn_bloqueia_estado();

-- 5. TRANSIÇÕES
create or replace function public.rc_mudar_estado(
  p_reporte       uuid,
  p_novo_estado   text,
  p_texto         text,
  p_data_prevista date default null
) returns public.reportes
language plpgsql security definer set search_path = public as $$
declare r public.reportes; v_eu uuid := public.rc_meu_funcionario_id(); v_res public.reportes;
begin
  select * into r from public.reportes where id = p_reporte;
  if not found then raise exception 'Reporte inexistente'; end if;
  if v_eu is null then raise exception 'Utilizador sem funcionário associado'; end if;
  if length(trim(coalesce(p_texto,''))) < 15 then
    raise exception 'Descreve a ação em pelo menos 15 caracteres.';
  end if;

  case
    when p_novo_estado = 'a_tratar' and r.estado = 'pendente' then
      if not public.rc_pertence_setor(r.setor_destino_id) then
        raise exception 'Só o setor destino pode assumir este reporte.'; end if;
      if p_data_prevista is null then
        raise exception 'Indica a data prevista de resolução.'; end if;

    when p_novo_estado in ('corrigido','nao_procede') and r.estado = 'a_tratar' then
      if not public.rc_pertence_setor(r.setor_destino_id) then
        raise exception 'Sem permissão sobre este setor.'; end if;

    when p_novo_estado = 'validado' and r.estado = 'corrigido' then
      if not public.rc_e_gestor() then raise exception 'Só o gestor valida.'; end if;

    when p_novo_estado = 'a_tratar' and r.estado in ('corrigido','nao_procede') then
      if r.reportado_por <> v_eu and not public.rc_e_gestor() then
        raise exception 'Só quem reportou (ou o gestor) pode contestar.'; end if;
      if r.contestado_em is not null and not public.rc_e_gestor() then
        raise exception 'Este reporte já foi contestado uma vez.'; end if;

    else raise exception 'Transição inválida: % -> %', r.estado, p_novo_estado;
  end case;

  perform set_config('app.rc_transicao', '1', true);

  update public.reportes set
    estado          = p_novo_estado,
    respondido_em   = case when p_novo_estado = 'a_tratar' and respondido_em is null
                           then now() else respondido_em end,
    prazo_resolucao = case when p_novo_estado = 'a_tratar' and prazo_resolucao is null
                           then public.rc_add_horas_uteis(now(), public.rc_cfg('horas_resolucao','24')::int)
                           else prazo_resolucao end,
    assumido_por    = case when p_novo_estado = 'a_tratar' then v_eu else assumido_por end,
    data_prevista   = coalesce(p_data_prevista, data_prevista),
    contestado_em   = case when r.estado in ('corrigido','nao_procede')
                            and p_novo_estado = 'a_tratar' then now() else contestado_em end
  where id = p_reporte
  returning * into v_res;

  perform set_config('app.rc_transicao', '0', true);

  update public.reporte_eventos set texto = p_texto
   where id = (select id from public.reporte_eventos
                where reporte_id = p_reporte and tipo = 'mudanca_estado'
                order by criado_em desc limit 1);

  return v_res;
end $$;

create or replace function public.rc_registar_decisao(p_reporte uuid, p_texto text)
returns public.reporte_eventos language plpgsql security definer set search_path = public as $$
declare e public.reporte_eventos;
begin
  if length(trim(coalesce(p_texto,''))) < 20 then
    raise exception 'A decisão tem de ficar escrita com clareza.'; end if;
  insert into public.reporte_eventos (reporte_id, autor_id, tipo, texto)
  values (p_reporte, public.rc_meu_funcionario_id(), 'decisao', p_texto) returning * into e;
  return e;
end $$;

create or replace function public.rc_reclassificar(p_reporte uuid, p_nova text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reportes;
begin
  select * into r from public.reportes where id = p_reporte;
  if not public.rc_e_responsavel(r.setor_destino_id) then raise exception 'Sem permissão.'; end if;
  if length(trim(coalesce(p_motivo,''))) < 10 then
    raise exception 'Justifica a reclassificação.'; end if;
  update public.reportes set gravidade = p_nova where id = p_reporte;
  insert into public.reporte_eventos (reporte_id, autor_id, tipo, texto)
  values (p_reporte, public.rc_meu_funcionario_id(), 'reclassificacao',
          format('Gravidade %s → %s. %s', r.gravidade, p_nova, p_motivo));
end $$;

-- 6. CHECKLISTS
create table public.alvos (
  id       uuid primary key default gen_random_uuid(),
  setor_id uuid not null references public.funcoes(id) on delete cascade,
  tipo     text not null,
  nome     text not null,
  ativo    boolean not null default true
);
grant select, insert, update, delete on public.alvos to authenticated;
grant all on public.alvos to service_role;
create index on public.alvos (setor_id, tipo) where ativo;

create table public.checklist_templates (
  id            uuid primary key default gen_random_uuid(),
  setor_id      uuid not null references public.funcoes(id) on delete cascade,
  nome          text not null,
  descricao     text,
  periodicidade text not null,
  dias_semana   int[] not null default '{1,2,3,4,5,6}',
  dia_mes       int,
  hora_limite   time not null default '23:59',
  alvo_tipo     text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  constraint checklist_templates_period_chk check (periodicidade = any (array
    ['diaria','semanal','mensal']))
);
grant select, insert, update, delete on public.checklist_templates to authenticated;
grant all on public.checklist_templates to service_role;
create index on public.checklist_templates (setor_id) where ativo;

create table public.checklist_itens (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references public.checklist_templates(id) on delete cascade,
  ordem             int not null,
  texto             text not null,
  instrucao         text,
  instrucao_media   text[] not null default '{}',
  tipo              text not null default 'ok_nok',
  obrigatorio       boolean not null default true,
  exige_foto_se_nok boolean not null default true,
  setor_reporte_id  uuid references public.funcoes(id) on delete set null,
  unique (template_id, ordem),
  constraint checklist_itens_tipo_chk check (tipo = any (array
    ['ok_nok','texto','numero','foto']))
);
grant select, insert, update, delete on public.checklist_itens to authenticated;
grant all on public.checklist_itens to service_role;

create table public.checklist_execucoes (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.checklist_templates(id) on delete cascade,
  alvo_id         uuid references public.alvos(id) on delete cascade,
  data_referencia date not null,
  estado          text not null default 'pendente',
  iniciada_em     timestamptz,
  concluida_em    timestamptz,
  concluida_por   uuid references public.funcionarios(id) on delete set null,
  criado_em       timestamptz not null default now(),
  constraint checklist_execucoes_estado_chk check (estado = any (array
    ['pendente','em_curso','concluida','em_falta']))
);
grant select, update on public.checklist_execucoes to authenticated;
grant all on public.checklist_execucoes to service_role;
create unique index on public.checklist_execucoes (template_id, data_referencia, alvo_id) nulls not distinct;
create index on public.checklist_execucoes (data_referencia, estado);

create table public.checklist_respostas (
  id             uuid primary key default gen_random_uuid(),
  execucao_id    uuid not null references public.checklist_execucoes(id) on delete cascade,
  item_id        uuid not null references public.checklist_itens(id) on delete cascade,
  valor          text not null,
  observacao     text,
  foto_url       text,
  respondido_por uuid not null references public.funcionarios(id) on delete restrict,
  respondido_em  timestamptz not null default now(),
  reporte_id     uuid references public.reportes(id) on delete set null,
  unique (execucao_id, item_id)
);
grant select, insert, update on public.checklist_respostas to authenticated;
grant all on public.checklist_respostas to service_role;
create index on public.checklist_respostas (respondido_por, respondido_em desc);

create or replace function public.rc_fn_nok_gera_reporte() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_item record; v_setor uuid; v_alvo text; v_rep uuid;
begin
  if lower(new.valor) <> 'nok' or new.reporte_id is not null then return new; end if;

  select i.texto, i.setor_reporte_id, t.setor_id as setor_template, t.nome as template_nome
    into v_item
    from public.checklist_itens i join public.checklist_templates t on t.id = i.template_id
   where i.id = new.item_id;

  v_setor := coalesce(v_item.setor_reporte_id, v_item.setor_template);

  select a.nome into v_alvo from public.checklist_execucoes e
    left join public.alvos a on a.id = e.alvo_id where e.id = new.execucao_id;

  insert into public.reportes (titulo, descricao, setor_origem_id, setor_destino_id,
                        reportado_por, gravidade, anexos)
  values (v_item.template_nome || ' — ' || v_item.texto ||
            coalesce(' · ' || v_alvo, ''),
          coalesce(new.observacao, 'Item reprovado na checklist.'),
          v_item.setor_template, v_setor, new.respondido_por, 'media',
          case when new.foto_url is null then '{}'::text[] else array[new.foto_url] end)
  returning id into v_rep;

  new.reporte_id := v_rep;
  return new;
end $$;

create trigger trg_rc_nok_gera_reporte before insert or update on public.checklist_respostas
for each row execute function public.rc_fn_nok_gera_reporte();

-- 7. GERAÇÃO E ESCALONAMENTO
create or replace function public.rc_gerar_execucoes(p_data date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare v_total int := 0; v_n int; t record; v_ref date;
begin
  for t in select * from public.checklist_templates where ativo loop
    v_ref := null;
    if t.periodicidade = 'diaria'
       and extract(isodow from p_data)::int = any(t.dias_semana) then
      v_ref := p_data;
    elsif t.periodicidade = 'semanal' and extract(isodow from p_data) = 1 then
      v_ref := p_data;
    elsif t.periodicidade = 'mensal'
       and extract(day from p_data)::int = coalesce(t.dia_mes, 1) then
      v_ref := date_trunc('month', p_data)::date;
    end if;
    if v_ref is null then continue; end if;

    if t.alvo_tipo is null then
      insert into public.checklist_execucoes (template_id, data_referencia)
      values (t.id, v_ref) on conflict do nothing;
    else
      insert into public.checklist_execucoes (template_id, alvo_id, data_referencia)
      select t.id, a.id, v_ref from public.alvos a
       where a.setor_id = t.setor_id and a.tipo = t.alvo_tipo and a.ativo
      on conflict do nothing;
    end if;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end $$;

create or replace function public.rc_marcar_em_falta()
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.checklist_execucoes e set estado = 'em_falta'
    from public.checklist_templates t
   where t.id = e.template_id
     and e.estado in ('pendente','em_curso')
     and (e.data_referencia + t.hora_limite) < now();
  get diagnostics v = row_count;
  return v;
end $$;

create table public.escalonamentos (
  id         uuid primary key default gen_random_uuid(),
  reporte_id uuid not null references public.reportes(id) on delete cascade,
  tipo       text not null check (tipo in ('resposta','resolucao')),
  criado_em  timestamptz not null default now()
);
grant select on public.escalonamentos to authenticated;
grant all on public.escalonamentos to service_role;

create or replace function public.rc_processar_escalonamentos()
returns int language plpgsql security definer set search_path = public as $$
declare v int := 0;
begin
  with novos as (
    update public.reportes set escalado_resposta = true
     where respondido_em is null and estado = 'pendente'
       and prazo_resposta < now() and not escalado_resposta
     returning id)
  insert into public.escalonamentos (reporte_id, tipo) select id, 'resposta' from novos;
  get diagnostics v = row_count;

  with novos as (
    update public.reportes set escalado_resolucao = true
     where fechado_em is null and estado = 'a_tratar'
       and prazo_resolucao < now() and not escalado_resolucao
     returning id)
  insert into public.escalonamentos (reporte_id, tipo) select id, 'resolucao' from novos;
  return v;
end $$;

create or replace function public.rc_manutencao_horaria()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.rc_marcar_em_falta();
  perform public.rc_processar_escalonamentos();
end $$;

do $$ begin
  perform cron.unschedule('rc-gerar-execucoes');
exception when others then null; end $$;
do $$ begin
  perform cron.unschedule('rc-manutencao-horaria');
exception when others then null; end $$;

select cron.schedule('rc-gerar-execucoes', '5 0 * * *', $$select public.rc_gerar_execucoes()$$);
select cron.schedule('rc-manutencao-horaria', '0 * * * *', $$select public.rc_manutencao_horaria()$$);

-- 8. RLS
alter table public.alvos               enable row level security;
alter table public.reportes            enable row level security;
alter table public.reporte_eventos     enable row level security;
alter table public.escalonamentos      enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_itens     enable row level security;
alter table public.checklist_execucoes enable row level security;
alter table public.checklist_respostas enable row level security;

create policy rc_sel_alvos    on public.alvos    for select to authenticated using (true);
create policy rc_adm_alvos    on public.alvos    for all to authenticated using (public.rc_e_gestor()) with check (public.rc_e_gestor());
create policy rc_sel_feriados on public.feriados for select to authenticated using (true);
create policy rc_adm_feriados on public.feriados for all to authenticated using (public.rc_e_gestor()) with check (public.rc_e_gestor());
create policy rc_sel_config   on public.rc_config for select to authenticated using (true);
create policy rc_adm_config   on public.rc_config for all to authenticated using (public.rc_e_gestor()) with check (public.rc_e_gestor());
create policy rc_sel_escal    on public.escalonamentos for select to authenticated using (public.rc_e_gestor());

create policy rc_sel_reportes on public.reportes for select to authenticated using (true);
create policy rc_ins_reportes on public.reportes for insert to authenticated
  with check (reportado_por = public.rc_meu_funcionario_id());
create policy rc_upd_reportes on public.reportes for update to authenticated
  using (public.rc_pertence_setor(setor_destino_id) or reportado_por = public.rc_meu_funcionario_id())
  with check (public.rc_pertence_setor(setor_destino_id) or reportado_por = public.rc_meu_funcionario_id());

create policy rc_sel_eventos on public.reporte_eventos for select to authenticated using (true);
create policy rc_ins_eventos on public.reporte_eventos for insert to authenticated with check (
  autor_id = public.rc_meu_funcionario_id() and exists (
    select 1 from public.reportes r where r.id = reporte_id and (
      public.rc_pertence_setor(r.setor_destino_id)
      or (r.setor_origem_id is not null and public.rc_pertence_setor(r.setor_origem_id))
      or r.reportado_por = public.rc_meu_funcionario_id())));

create policy rc_sel_templates on public.checklist_templates for select to authenticated
  using (public.rc_pertence_setor(setor_id));
create policy rc_adm_templates on public.checklist_templates for all to authenticated
  using (public.rc_e_gestor()) with check (public.rc_e_gestor());

create policy rc_sel_itens on public.checklist_itens for select to authenticated using (exists (
  select 1 from public.checklist_templates t where t.id = template_id and public.rc_pertence_setor(t.setor_id)));
create policy rc_adm_itens on public.checklist_itens for all to authenticated
  using (public.rc_e_gestor()) with check (public.rc_e_gestor());

create policy rc_sel_exec on public.checklist_execucoes for select to authenticated using (exists (
  select 1 from public.checklist_templates t where t.id = template_id and public.rc_pertence_setor(t.setor_id)));
create policy rc_upd_exec on public.checklist_execucoes for update to authenticated using (exists (
  select 1 from public.checklist_templates t where t.id = template_id and public.rc_pertence_setor(t.setor_id)));

create policy rc_sel_resp on public.checklist_respostas for select to authenticated using (exists (
  select 1 from public.checklist_execucoes e join public.checklist_templates t on t.id = e.template_id
   where e.id = execucao_id and public.rc_pertence_setor(t.setor_id)));
create policy rc_ins_resp on public.checklist_respostas for insert to authenticated with check (
  respondido_por = public.rc_meu_funcionario_id() and exists (
    select 1 from public.checklist_execucoes e join public.checklist_templates t on t.id = e.template_id
     where e.id = execucao_id and public.rc_pertence_setor(t.setor_id)));
create policy rc_upd_resp on public.checklist_respostas for update to authenticated using (exists (
  select 1 from public.checklist_execucoes e join public.checklist_templates t on t.id = e.template_id
   where e.id = execucao_id and public.rc_pertence_setor(t.setor_id)));

-- 9. VIEWS DO PAINEL
create or replace view public.vw_reportes_painel with (security_invoker = on) as
select
  r.id, r.numero, r.titulo, r.estado, r.gravidade,
  r.criado_em, r.respondido_em, r.fechado_em,
  r.prazo_resposta, r.prazo_resolucao, r.data_prevista,
  so.nome as setor_origem,  r.setor_origem_id,
  sd.nome as setor_destino, r.setor_destino_id,
  fr.nome as reportado_por_nome, r.reportado_por,
  fa.nome as assumido_por_nome,  r.assumido_por,
  r.contestado_em is not null as foi_contestado,
  case when r.respondido_em is not null
       then public.rc_horas_uteis_entre(r.criado_em, r.respondido_em) end as horas_ate_resposta,
  (r.respondido_em is null and now() > r.prazo_resposta) as resposta_em_atraso,
  case when r.fechado_em is not null and r.respondido_em is not null
       then public.rc_horas_uteis_entre(r.respondido_em, r.fechado_em) end as horas_ate_resolucao,
  (r.fechado_em is null and r.prazo_resolucao is not null
       and now() > r.prazo_resolucao) as resolucao_em_atraso,
  (select count(*) from public.reporte_eventos e
    where e.reporte_id = r.id and e.tipo = 'comentario') as n_comentarios,
  (select count(*) from public.reporte_eventos e
    where e.reporte_id = r.id and e.tipo = 'decisao')    as n_decisoes
from public.reportes r
join public.funcoes sd on sd.id = r.setor_destino_id
left join public.funcoes so on so.id = r.setor_origem_id
join public.funcionarios fr on fr.id = r.reportado_por
left join public.funcionarios fa on fa.id = r.assumido_por;

create or replace view public.vw_desempenho_setor with (security_invoker = on) as
select setor_destino_id, setor_destino, date_trunc('month', criado_em)::date as mes,
  count(*)                                       as total,
  count(*) filter (where estado = 'pendente')    as pendentes,
  count(*) filter (where estado = 'a_tratar')    as em_tratamento,
  count(*) filter (where estado = 'validado')    as fechados,
  count(*) filter (where estado = 'nao_procede') as recusados,
  count(*) filter (where resposta_em_atraso)     as resposta_atrasada,
  count(*) filter (where resolucao_em_atraso)    as resolucao_atrasada,
  count(*) filter (where foi_contestado)         as contestados,
  round(avg(horas_ate_resposta), 1)              as media_h_resposta,
  round(avg(horas_ate_resolucao), 1)             as media_h_resolucao
from public.vw_reportes_painel group by 1,2,3;

create or replace view public.vw_cumprimento_checklists with (security_invoker = on) as
select t.setor_id, s.nome as setor, t.id as template_id, t.nome as checklist,
  t.periodicidade, e.id as execucao_id, e.data_referencia, a.nome as alvo,
  e.estado, e.concluida_em, f.nome as concluida_por,
  (select count(*) from public.checklist_itens i where i.template_id = t.id) as itens_total,
  (select count(*) from public.checklist_respostas r where r.execucao_id = e.id) as itens_respondidos,
  (select count(*) from public.checklist_respostas r
    where r.execucao_id = e.id and lower(r.valor) = 'nok') as itens_nok
from public.checklist_execucoes e
join public.checklist_templates t on t.id = e.template_id
join public.funcoes s on s.id = t.setor_id
left join public.alvos a on a.id = e.alvo_id
left join public.funcionarios f on f.id = e.concluida_por;

create or replace view public.vw_atividade_colaborador with (security_invoker = on) as
select f.id as funcionario_id, f.nome, m.mes,
  (select count(*) from public.reportes r
    where r.reportado_por = f.id and date_trunc('month', r.criado_em) = m.mes) as reportes_criados,
  (select count(*) from public.reportes r
    where r.assumido_por = f.id and date_trunc('month', r.respondido_em) = m.mes) as reportes_assumidos,
  (select count(*) from public.checklist_respostas cr
    where cr.respondido_por = f.id and date_trunc('month', cr.respondido_em) = m.mes) as itens_respondidos,
  (select count(*) from public.checklist_respostas cr
    where cr.respondido_por = f.id and lower(cr.valor) = 'nok'
      and date_trunc('month', cr.respondido_em) = m.mes) as itens_nok,
  (select count(*) from public.checklist_execucoes ce
    where ce.concluida_por = f.id and date_trunc('month', ce.concluida_em) = m.mes) as execucoes_concluidas
from public.funcionarios f
cross join (
  select generate_series(date_trunc('month', now()) - interval '11 months',
                         date_trunc('month', now()), interval '1 month') as mes) m
where f.ativo;

grant select on public.vw_reportes_painel, public.vw_desempenho_setor,
  public.vw_cumprimento_checklists, public.vw_atividade_colaborador to authenticated;

-- Execução restrita
revoke execute on function public.rc_cfg(text, text), public.rc_e_dia_util(date),
  public.rc_add_horas_uteis(timestamptz, int), public.rc_horas_uteis_entre(timestamptz, timestamptz),
  public.rc_meu_funcionario_id(), public.rc_e_gestor(), public.rc_meus_setores(),
  public.rc_pertence_setor(uuid), public.rc_e_responsavel(uuid),
  public.rc_mudar_estado(uuid, text, text, date), public.rc_registar_decisao(uuid, text),
  public.rc_reclassificar(uuid, text, text), public.rc_gerar_execucoes(date),
  public.rc_marcar_em_falta(), public.rc_processar_escalonamentos(),
  public.rc_manutencao_horaria() from public;

grant execute on function public.rc_cfg(text, text), public.rc_e_dia_util(date),
  public.rc_add_horas_uteis(timestamptz, int), public.rc_horas_uteis_entre(timestamptz, timestamptz),
  public.rc_meu_funcionario_id(), public.rc_e_gestor(), public.rc_meus_setores(),
  public.rc_pertence_setor(uuid), public.rc_e_responsavel(uuid),
  public.rc_mudar_estado(uuid, text, text, date), public.rc_registar_decisao(uuid, text),
  public.rc_reclassificar(uuid, text, text) to authenticated;

-- 10. REALTIME
alter publication supabase_realtime add table public.checklist_respostas;
alter publication supabase_realtime add table public.checklist_execucoes;
alter publication supabase_realtime add table public.reportes;
alter publication supabase_realtime add table public.reporte_eventos;