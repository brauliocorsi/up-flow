
-- 1) Schema: tarefas_dia ganha hora_inicio, hora_fim, atividade_id, tipo
ALTER TABLE public.tarefas_dia
  ADD COLUMN IF NOT EXISTS hora_inicio time without time zone,
  ADD COLUMN IF NOT EXISTS hora_fim time without time zone,
  ADD COLUMN IF NOT EXISTS atividade_id uuid REFERENCES public.atividades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'atividade';

-- estado check: incluir 'pausa'
ALTER TABLE public.tarefas_dia DROP CONSTRAINT IF EXISTS tarefas_dia_estado_check;
ALTER TABLE public.tarefas_dia ADD CONSTRAINT tarefas_dia_estado_check
  CHECK (estado = ANY (ARRAY['pendente','a_decorrer','pausada','saltada','concluida','pausa']));
ALTER TABLE public.tarefas_dia DROP CONSTRAINT IF EXISTS tarefas_dia_tipo_check;
ALTER TABLE public.tarefas_dia ADD CONSTRAINT tarefas_dia_tipo_check
  CHECK (tipo = ANY (ARRAY['atividade','pausa']));

CREATE INDEX IF NOT EXISTS tarefas_dia_func_data_hora_idx
  ON public.tarefas_dia(funcionario_id, data, hora_inicio, ordem);

-- 2) Helper: garantir atividade para um título dentro dos setores do funcionário
CREATE OR REPLACE FUNCTION public._garantir_atividade(_funcionario_id uuid, _titulo text, _minutos integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at uuid;
  v_funcao uuid;
BEGIN
  -- match por nome dentro de algum setor do funcionário
  SELECT a.id INTO v_at
  FROM public.atividades a
  WHERE a.ativo = true
    AND lower(a.nome) = lower(coalesce(_titulo,''))
    AND a.funcao_id IN (
      SELECT fs.funcao_id FROM public.funcionario_setores fs WHERE fs.funcionario_id = _funcionario_id
      UNION
      SELECT f.funcao_id FROM public.funcionarios f WHERE f.id = _funcionario_id AND f.funcao_id IS NOT NULL
    )
  LIMIT 1;
  IF v_at IS NOT NULL THEN RETURN v_at; END IF;

  -- fallback: qualquer atividade com esse nome
  SELECT id INTO v_at FROM public.atividades
    WHERE ativo = true AND lower(nome) = lower(coalesce(_titulo,'')) LIMIT 1;
  IF v_at IS NOT NULL THEN RETURN v_at; END IF;

  -- criar nova: escolher um setor do funcionário (primeiro de funcionario_setores ou funcao_id)
  SELECT fs.funcao_id INTO v_funcao
    FROM public.funcionario_setores fs WHERE fs.funcionario_id = _funcionario_id LIMIT 1;
  IF v_funcao IS NULL THEN
    SELECT funcao_id INTO v_funcao FROM public.funcionarios WHERE id = _funcionario_id;
  END IF;
  IF v_funcao IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.atividades (nome, funcao_id, duracao_padrao_min, ativo)
  VALUES (coalesce(NULLIF(_titulo,''), 'Atividade'), v_funcao, GREATEST(coalesce(_minutos,15),1), true)
  RETURNING id INTO v_at;
  RETURN v_at;
END;
$$;
REVOKE ALL ON FUNCTION public._garantir_atividade(uuid,text,integer) FROM PUBLIC, anon, authenticated;

-- 3) Migração: templates antigos -> rotina_blocos (idempotente)
CREATE OR REPLACE FUNCTION public.migrar_templates_para_blocos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_func record;
  v_dia int;
  v_tipo_dia text;
  v_horario record;
  v_template_id uuid;
  v_pausa record;
  v_tt record;
  v_cursor time;
  v_fim time;
  v_dur interval;
  v_overlap boolean;
  v_ordem int;
  v_atividade uuid;
BEGIN
  FOR v_func IN SELECT id, funcao_id FROM public.funcionarios WHERE ativo = true LOOP
    FOR v_dia IN 1..6 LOOP
      -- skip se já houver blocos para este dia
      IF EXISTS (SELECT 1 FROM public.rotina_blocos WHERE funcionario_id = v_func.id AND dia_semana = v_dia) THEN
        CONTINUE;
      END IF;

      v_tipo_dia := CASE WHEN v_dia = 6 THEN 'sabado' ELSE 'util' END;

      -- template antigo deste funcionário/dia
      SELECT id INTO v_template_id FROM public.rotina_templates
        WHERE funcao_id = v_func.funcao_id AND dia_semana = v_dia LIMIT 1;
      IF v_template_id IS NULL THEN CONTINUE; END IF;

      -- horário do dia
      SELECT hora_inicio, hora_fim INTO v_horario
      FROM public.horarios_trabalho
        WHERE funcionario_id = v_func.id AND tipo_dia = v_tipo_dia AND ativo = true
        LIMIT 1;
      IF v_horario IS NULL THEN CONTINUE; END IF;

      v_cursor := v_horario.hora_inicio;
      v_ordem := 0;

      FOR v_tt IN
        SELECT id, titulo, minutos_previstos, ordem
        FROM public.template_tarefas
        WHERE template_id = v_template_id
        ORDER BY ordem
      LOOP
        v_dur := make_interval(mins => GREATEST(coalesce(v_tt.minutos_previstos, 15), 1));

        -- saltar pausas que colidam (loop até não colidir)
        LOOP
          v_overlap := false;
          FOR v_pausa IN
            SELECT hora_inicio, hora_fim
            FROM public.pausas_fixas
            WHERE funcionario_id = v_func.id AND tipo_dia = v_tipo_dia AND ativo = true
            ORDER BY hora_inicio
          LOOP
            IF v_pausa.hora_inicio < (v_cursor + v_dur) AND v_pausa.hora_fim > v_cursor THEN
              v_cursor := v_pausa.hora_fim;
              v_overlap := true;
              EXIT;
            END IF;
          END LOOP;
          EXIT WHEN NOT v_overlap;
        END LOOP;

        v_fim := v_cursor + v_dur;
        IF v_fim > v_horario.hora_fim THEN
          EXIT; -- não cabe mais nada
        END IF;

        v_atividade := public._garantir_atividade(v_func.id, v_tt.titulo, v_tt.minutos_previstos);
        IF v_atividade IS NULL THEN
          v_cursor := v_fim;
          CONTINUE;
        END IF;

        v_ordem := v_ordem + 1;
        INSERT INTO public.rotina_blocos (funcionario_id, dia_semana, atividade_id, hora_inicio, hora_fim, ordem)
        VALUES (v_func.id, v_dia, v_atividade, v_cursor, v_fim, v_ordem);

        v_cursor := v_fim;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.migrar_templates_para_blocos() FROM PUBLIC, anon, authenticated;

-- Executar migração
SELECT public.migrar_templates_para_blocos();

-- 4) Nova geração diária: lê rotina_blocos + insere pausas fixas como blocos visíveis
CREATE OR REPLACE FUNCTION public.gerar_tarefas_do_dia(_funcionario_id uuid, _data date)
RETURNS TABLE(id uuid, titulo text, ordem integer, minutos_previstos integer, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- idempotência
  IF EXISTS (SELECT 1 FROM public.tarefas_dia td WHERE td.funcionario_id = _funcionario_id AND td.data = _data) THEN
    RETURN QUERY
      SELECT td.id, td.titulo, td.ordem, td.minutos_previstos, td.estado
      FROM public.tarefas_dia td
      WHERE td.funcionario_id = _funcionario_id AND td.data = _data
      ORDER BY td.hora_inicio NULLS LAST, td.ordem;
    RETURN;
  END IF;

  -- Inserir blocos de actividade
  FOR v_bloco IN
    SELECT rb.atividade_id, rb.hora_inicio, rb.hora_fim, rb.ordem, a.nome, a.duracao_padrao_min
    FROM public.rotina_blocos rb
    LEFT JOIN public.atividades a ON a.id = rb.atividade_id
    WHERE rb.funcionario_id = _funcionario_id AND rb.dia_semana = v_dow
    ORDER BY rb.hora_inicio, rb.ordem
  LOOP
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

  -- Inserir pausas fixas como blocos visíveis (não executáveis)
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
$$;

-- Conceder execução apenas a authenticated (alinhado com pattern existente)
REVOKE ALL ON FUNCTION public.gerar_tarefas_do_dia(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_tarefas_do_dia(uuid, date) TO authenticated;
