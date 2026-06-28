
-- Cadência das atividades (semanal por defeito, ou quinzenal A/B, ou mensal 1ª/2ª/3ª/4ª/última semana)
ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS cadencia text NOT NULL DEFAULT 'semanal';

ALTER TABLE public.atividades
  DROP CONSTRAINT IF EXISTS atividades_cadencia_check;
ALTER TABLE public.atividades
  ADD CONSTRAINT atividades_cadencia_check
  CHECK (cadencia IN ('semanal','quinzenal_a','quinzenal_b','mensal_1','mensal_2','mensal_3','mensal_4','mensal_ultima'));

-- Helper: dado um dia, retorna se a cadência se aplica
CREATE OR REPLACE FUNCTION public.cadencia_aplica(_cadencia text, _data date)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_week int;
  v_dom int;
  v_ordinal int;
  v_dow int;
  v_last_of_month date;
  v_last_same_dow date;
BEGIN
  IF _cadencia IS NULL OR _cadencia = 'semanal' THEN
    RETURN true;
  END IF;

  IF _cadencia IN ('quinzenal_a','quinzenal_b') THEN
    v_week := EXTRACT(WEEK FROM _data)::int;
    IF _cadencia = 'quinzenal_a' THEN
      RETURN (v_week % 2) = 1;
    ELSE
      RETURN (v_week % 2) = 0;
    END IF;
  END IF;

  -- mensal_N: a N-ésima ocorrência deste dia-da-semana no mês
  v_dom := EXTRACT(DAY FROM _data)::int;
  v_ordinal := ((v_dom - 1) / 7) + 1;

  IF _cadencia = 'mensal_1' THEN RETURN v_ordinal = 1; END IF;
  IF _cadencia = 'mensal_2' THEN RETURN v_ordinal = 2; END IF;
  IF _cadencia = 'mensal_3' THEN RETURN v_ordinal = 3; END IF;
  IF _cadencia = 'mensal_4' THEN RETURN v_ordinal = 4; END IF;

  IF _cadencia = 'mensal_ultima' THEN
    v_dow := EXTRACT(ISODOW FROM _data)::int;
    v_last_of_month := (date_trunc('month', _data) + interval '1 month - 1 day')::date;
    -- recuar até ao mesmo dow
    v_last_same_dow := v_last_of_month - ((EXTRACT(ISODOW FROM v_last_of_month)::int - v_dow + 7) % 7);
    RETURN _data = v_last_same_dow;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.cadencia_aplica(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cadencia_aplica(text, date) TO authenticated, anon, service_role;

-- Actualizar gerar_tarefas_do_dia para respeitar a cadência das atividades
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
           a.nome, a.duracao_padrao_min, a.cadencia
    FROM public.rotina_blocos rb
    LEFT JOIN public.atividades a ON a.id = rb.atividade_id
    WHERE rb.funcionario_id = _funcionario_id AND rb.dia_semana = v_dow
    ORDER BY rb.hora_inicio, rb.ordem
  LOOP
    -- Pular blocos cuja cadência não se aplica a esta data
    IF NOT public.cadencia_aplica(coalesce(v_bloco.cadencia,'semanal'), _data) THEN
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
