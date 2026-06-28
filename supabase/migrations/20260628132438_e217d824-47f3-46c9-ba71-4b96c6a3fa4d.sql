ALTER TABLE public.rotina_blocos ADD COLUMN IF NOT EXISTS cadencia text NOT NULL DEFAULT 'semanal';

ALTER TABLE public.rotina_blocos DROP CONSTRAINT IF EXISTS rotina_blocos_cadencia_check;
ALTER TABLE public.rotina_blocos ADD CONSTRAINT rotina_blocos_cadencia_check
  CHECK (cadencia IN ('semanal','quinzenal_a','quinzenal_b','mensal_1','mensal_2','mensal_3','mensal_4','mensal_ultima'));

CREATE OR REPLACE FUNCTION public.gerar_tarefas_do_dia(_funcionario_id uuid, _data date)
 RETURNS TABLE(id uuid, titulo text, ordem integer, minutos_previstos integer, estado text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dow int;
  v_tipo_dia text;
  v_bloco record;
  v_pausa record;
  v_ordem int := 0;
  v_minutos int;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'gestor') OR public.is_my_funcionario(_funcionario_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_dow := EXTRACT(ISODOW FROM _data)::int;
  IF v_dow = 7 THEN
    RETURN;
  END IF;
  v_tipo_dia := CASE WHEN v_dow = 6 THEN 'sabado' ELSE 'util' END;

  IF EXISTS (SELECT 1 FROM public.tarefas_dia td WHERE td.funcionario_id = _funcionario_id AND td.data = _data) THEN
    RETURN QUERY
      SELECT td.id, td.titulo, td.ordem, td.minutos_previstos, td.estado
      FROM public.tarefas_dia td
      WHERE td.funcionario_id = _funcionario_id AND td.data = _data
      ORDER BY td.hora_inicio NULLS LAST, td.ordem;
    RETURN;
  END IF;

  FOR v_bloco IN
    SELECT rb.atividade_id, rb.hora_inicio, rb.hora_fim, rb.ordem,
           rb.cadencia AS bloco_cadencia,
           a.nome, a.duracao_padrao_min, a.cadencia AS atividade_cadencia
    FROM public.rotina_blocos rb
    LEFT JOIN public.atividades a ON a.id = rb.atividade_id
    WHERE rb.funcionario_id = _funcionario_id AND rb.dia_semana = v_dow
    ORDER BY rb.hora_inicio, rb.ordem
  LOOP
    IF NOT public.cadencia_aplica(coalesce(v_bloco.bloco_cadencia, v_bloco.atividade_cadencia, 'semanal'), _data) THEN
      CONTINUE;
    END IF;

    v_ordem := v_ordem + 1;
    v_minutos := GREATEST(
      coalesce(EXTRACT(EPOCH FROM (v_bloco.hora_fim - v_bloco.hora_inicio))/60, v_bloco.duracao_padrao_min, 15)::int,
      1
    );
    v_nome := coalesce(v_bloco.nome, 'Atividade');
    INSERT INTO public.tarefas_dia
      (funcionario_id, data, titulo, ordem, minutos_previstos, estado, hora_inicio, hora_fim, atividade_id, tipo)
    VALUES
      (_funcionario_id, _data, v_nome, v_ordem, v_minutos, 'pendente',
       v_bloco.hora_inicio, v_bloco.hora_fim, v_bloco.atividade_id, 'atividade');
  END LOOP;

  FOR v_pausa IN
    SELECT nome, hora_inicio, hora_fim
    FROM public.pausas_fixas
    WHERE funcionario_id = _funcionario_id AND tipo_dia = v_tipo_dia AND ativo = true
    ORDER BY hora_inicio
  LOOP
    v_ordem := v_ordem + 1;
    v_minutos := GREATEST(EXTRACT(EPOCH FROM (v_pausa.hora_fim - v_pausa.hora_inicio))/60, 1)::int;
    INSERT INTO public.tarefas_dia
      (funcionario_id, data, titulo, ordem, minutos_previstos, estado, hora_inicio, hora_fim, tipo)
    VALUES
      (_funcionario_id, _data, v_pausa.nome, v_ordem, v_minutos, 'pausa',
       v_pausa.hora_inicio, v_pausa.hora_fim, 'pausa');
  END LOOP;

  RETURN QUERY
    SELECT td.id, td.titulo, td.ordem, td.minutos_previstos, td.estado
    FROM public.tarefas_dia td
    WHERE td.funcionario_id = _funcionario_id AND td.data = _data
    ORDER BY td.hora_inicio NULLS LAST, td.ordem;
END;
$function$;

CREATE OR REPLACE FUNCTION public.copiar_rotina_dia(_funcionario_id uuid, _dia_origem integer, _dias_destino integer[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOREACH d IN ARRAY _dias_destino LOOP
    IF d = _dia_origem THEN CONTINUE; END IF;
    IF d < 1 OR d > 6 THEN CONTINUE; END IF;
    DELETE FROM public.rotina_blocos
      WHERE funcionario_id = _funcionario_id AND dia_semana = d;
    INSERT INTO public.rotina_blocos
      (funcionario_id, dia_semana, atividade_id, hora_inicio, hora_fim, ordem, cadencia)
    SELECT funcionario_id, d, atividade_id, hora_inicio, hora_fim, ordem, cadencia
      FROM public.rotina_blocos
      WHERE funcionario_id = _funcionario_id AND dia_semana = _dia_origem;
  END LOOP;
END;
$function$;