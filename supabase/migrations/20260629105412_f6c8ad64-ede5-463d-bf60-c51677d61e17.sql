
-- 1) rotina_blocos: grupo_id para agrupar blocos diários replicados
ALTER TABLE public.rotina_blocos
  ADD COLUMN IF NOT EXISTS grupo_id uuid;

CREATE INDEX IF NOT EXISTS idx_rotina_blocos_grupo ON public.rotina_blocos(grupo_id);

-- 2) tarefas_dia: ligação ao bloco de origem
ALTER TABLE public.tarefas_dia
  ADD COLUMN IF NOT EXISTS bloco_id uuid REFERENCES public.rotina_blocos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_dia_bloco ON public.tarefas_dia(bloco_id);

-- 3) Tabela de exceções por bloco
CREATE TABLE IF NOT EXISTS public.rotina_bloco_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id uuid NOT NULL REFERENCES public.rotina_blocos(id) ON DELETE CASCADE,
  data date NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (bloco_id, data)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotina_bloco_excecoes TO authenticated;
GRANT ALL ON public.rotina_bloco_excecoes TO service_role;

ALTER TABLE public.rotina_bloco_excecoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gestores fazem tudo nas excecoes" ON public.rotina_bloco_excecoes;
CREATE POLICY "gestores fazem tudo nas excecoes"
  ON public.rotina_bloco_excecoes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

DROP POLICY IF EXISTS "funcionario ve as suas excecoes" ON public.rotina_bloco_excecoes;
CREATE POLICY "funcionario ve as suas excecoes"
  ON public.rotina_bloco_excecoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rotina_blocos rb
      WHERE rb.id = bloco_id AND public.is_my_funcionario(rb.funcionario_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_excecoes_bloco_data ON public.rotina_bloco_excecoes(bloco_id, data);

-- 4) cadencia_aplica: suportar 'diaria' (seg-sex)
CREATE OR REPLACE FUNCTION public.cadencia_aplica(_cadencia text, _data date)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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

  IF _cadencia = 'diaria' THEN
    v_dow := EXTRACT(ISODOW FROM _data)::int;
    RETURN v_dow BETWEEN 1 AND 5;
  END IF;

  IF _cadencia IN ('quinzenal_a','quinzenal_b') THEN
    v_week := EXTRACT(WEEK FROM _data)::int;
    IF _cadencia = 'quinzenal_a' THEN
      RETURN (v_week % 2) = 1;
    ELSE
      RETURN (v_week % 2) = 0;
    END IF;
  END IF;

  v_dom := EXTRACT(DAY FROM _data)::int;
  v_ordinal := ((v_dom - 1) / 7) + 1;

  IF _cadencia = 'mensal_1' THEN RETURN v_ordinal = 1; END IF;
  IF _cadencia = 'mensal_2' THEN RETURN v_ordinal = 2; END IF;
  IF _cadencia = 'mensal_3' THEN RETURN v_ordinal = 3; END IF;
  IF _cadencia = 'mensal_4' THEN RETURN v_ordinal = 4; END IF;

  IF _cadencia = 'mensal_ultima' THEN
    v_dow := EXTRACT(ISODOW FROM _data)::int;
    v_last_of_month := (date_trunc('month', _data) + interval '1 month - 1 day')::date;
    v_last_same_dow := v_last_of_month - ((EXTRACT(ISODOW FROM v_last_of_month)::int - v_dow + 7) % 7);
    RETURN _data = v_last_same_dow;
  END IF;

  RETURN false;
END;
$function$;

-- 5) gerar_tarefas_do_dia: respeitar exceções, gravar bloco_id, manter resto
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
    SELECT rb.id AS bloco_id, rb.atividade_id, rb.hora_inicio, rb.hora_fim, rb.ordem,
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

    -- Saltar se houver exceção para esta data
    IF EXISTS (
      SELECT 1 FROM public.rotina_bloco_excecoes ex
      WHERE ex.bloco_id = v_bloco.bloco_id AND ex.data = _data
    ) THEN
      CONTINUE;
    END IF;

    v_ordem := v_ordem + 1;
    v_minutos := GREATEST(
      coalesce(EXTRACT(EPOCH FROM (v_bloco.hora_fim - v_bloco.hora_inicio))/60, v_bloco.duracao_padrao_min, 15)::int,
      1
    );
    v_nome := coalesce(v_bloco.nome, 'Atividade');
    INSERT INTO public.tarefas_dia
      (funcionario_id, data, titulo, ordem, minutos_previstos, estado, hora_inicio, hora_fim, atividade_id, tipo, bloco_id)
    VALUES
      (_funcionario_id, _data, v_nome, v_ordem, v_minutos, 'pendente',
       v_bloco.hora_inicio, v_bloco.hora_fim, v_bloco.atividade_id, 'atividade', v_bloco.bloco_id);
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

REVOKE EXECUTE ON FUNCTION public.gerar_tarefas_do_dia(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_tarefas_do_dia(uuid, date) TO authenticated;

-- 6) RPC: saltar uma data específica para um bloco (cria exceção + apaga tarefa pendente desse dia)
CREATE OR REPLACE FUNCTION public.saltar_bloco_data(_bloco_id uuid, _data date, _motivo text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_func uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT funcionario_id INTO v_func FROM public.rotina_blocos WHERE id = _bloco_id;
  IF v_func IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'gestor') OR public.is_my_funcionario(v_func)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.rotina_bloco_excecoes (bloco_id, data, motivo, created_by)
  VALUES (_bloco_id, _data, _motivo, auth.uid())
  ON CONFLICT (bloco_id, data) DO UPDATE SET motivo = EXCLUDED.motivo;

  -- Remover tarefa pendente desse dia (não toca em tarefas já iniciadas/concluídas/saltadas)
  DELETE FROM public.tarefas_dia
   WHERE bloco_id = _bloco_id
     AND data = _data
     AND estado = 'pendente';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.saltar_bloco_data(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saltar_bloco_data(uuid, date, text) TO authenticated;

-- 7) RPC: remover exceção (desfazer)
CREATE OR REPLACE FUNCTION public.remover_excecao_bloco(_bloco_id uuid, _data date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_func uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT funcionario_id INTO v_func FROM public.rotina_blocos WHERE id = _bloco_id;
  IF v_func IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  DELETE FROM public.rotina_bloco_excecoes
   WHERE bloco_id = _bloco_id AND data = _data;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.remover_excecao_bloco(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_excecao_bloco(uuid, date) TO authenticated;
