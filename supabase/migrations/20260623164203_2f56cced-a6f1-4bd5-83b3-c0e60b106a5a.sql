-- 1) Realtime: full row payload + add to publication
ALTER TABLE public.tarefas_dia REPLICA IDENTITY FULL;
ALTER TABLE public.execucoes REPLICA IDENTITY FULL;
ALTER TABLE public.eventos REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas_dia';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.execucoes';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 2) Demo data generator (gestor only, idempotent)
CREATE OR REPLACE FUNCTION public.gerar_dados_demo(_data date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marcela uuid;
  v_leandro uuid;
  v_motivo_recebimento uuid;
  v_now timestamptz := now();
  rec record;
  i int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_marcela FROM public.funcionarios WHERE nome = 'Marcela' AND ativo LIMIT 1;
  SELECT id INTO v_leandro FROM public.funcionarios WHERE nome = 'Leandro' AND ativo LIMIT 1;
  SELECT id INTO v_motivo_recebimento FROM public.motivos_pausa
    WHERE label = 'Recebimento de fornecedor' LIMIT 1;

  IF v_marcela IS NULL OR v_leandro IS NULL THEN
    RAISE EXCEPTION 'demo_funcionarios_missing';
  END IF;

  -- Ensure tasks for today exist
  PERFORM public.gerar_tarefas_do_dia(v_marcela, _data);
  PERFORM public.gerar_tarefas_do_dia(v_leandro, _data);

  -- Clean previous demo state for these two so it's idempotent
  DELETE FROM public.execucoes e
    USING public.tarefas_dia td
    WHERE e.tarefa_dia_id = td.id
      AND td.data = _data
      AND td.funcionario_id IN (v_marcela, v_leandro);
  UPDATE public.tarefas_dia SET estado = 'pendente'
    WHERE data = _data AND funcionario_id IN (v_marcela, v_leandro);
  DELETE FROM public.eventos
    WHERE funcionario_id IN (v_marcela, v_leandro)
      AND inicio::date = _data
      AND descricao LIKE '[DEMO]%';

  -- Marcela: 3 concluídas, 1 a_decorrer (~20min), restantes pendentes
  i := 0;
  FOR rec IN
    SELECT id, ordem, minutos_previstos FROM public.tarefas_dia
    WHERE funcionario_id = v_marcela AND data = _data
    ORDER BY ordem
  LOOP
    i := i + 1;
    IF i <= 3 THEN
      UPDATE public.tarefas_dia SET estado = 'concluida' WHERE id = rec.id;
      INSERT INTO public.execucoes (tarefa_dia_id, inicio, fim)
      VALUES (
        rec.id,
        v_now - ((4 - i) * GREATEST(rec.minutos_previstos, 5) || ' minutes')::interval - interval '20 minutes',
        v_now - ((3 - i) * GREATEST(rec.minutos_previstos, 5) || ' minutes')::interval - interval '20 minutes'
      );
    ELSIF i = 4 THEN
      UPDATE public.tarefas_dia SET estado = 'a_decorrer' WHERE id = rec.id;
      INSERT INTO public.execucoes (tarefa_dia_id, inicio)
      VALUES (rec.id, v_now - interval '20 minutes');
    END IF;
  END LOOP;

  -- Leandro: 2 concluídas, 1 pausada (com motivo), restantes pendentes
  i := 0;
  FOR rec IN
    SELECT id, ordem, minutos_previstos FROM public.tarefas_dia
    WHERE funcionario_id = v_leandro AND data = _data
    ORDER BY ordem
  LOOP
    i := i + 1;
    IF i <= 2 THEN
      UPDATE public.tarefas_dia SET estado = 'concluida' WHERE id = rec.id;
      INSERT INTO public.execucoes (tarefa_dia_id, inicio, fim)
      VALUES (
        rec.id,
        v_now - ((3 - i) * GREATEST(rec.minutos_previstos, 5) || ' minutes')::interval - interval '15 minutes',
        v_now - ((2 - i) * GREATEST(rec.minutos_previstos, 5) || ' minutes')::interval - interval '15 minutes'
      );
    ELSIF i = 3 THEN
      UPDATE public.tarefas_dia SET estado = 'pausada' WHERE id = rec.id;
      INSERT INTO public.execucoes (tarefa_dia_id, inicio, motivo_pausa_id)
      VALUES (rec.id, v_now - interval '8 minutes', v_motivo_recebimento);
    END IF;
  END LOOP;

  -- Leandro: evento "recebimento" aberto (DEMO)
  INSERT INTO public.eventos (funcionario_id, tipo, titulo, descricao, inicio, criado_por)
  VALUES (v_leandro, 'recebimento', 'Recebimento de fornecedor', '[DEMO] entrega de painéis', v_now - interval '6 minutes', 'gestor');
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_dados_demo(date) FROM public;
GRANT EXECUTE ON FUNCTION public.gerar_dados_demo(date) TO authenticated;

-- 3) Demo data cleanup (gestor only)
CREATE OR REPLACE FUNCTION public.limpar_dados_demo(_data date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marcela uuid;
  v_leandro uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_marcela FROM public.funcionarios WHERE nome = 'Marcela' LIMIT 1;
  SELECT id INTO v_leandro FROM public.funcionarios WHERE nome = 'Leandro' LIMIT 1;

  DELETE FROM public.execucoes e
    USING public.tarefas_dia td
    WHERE e.tarefa_dia_id = td.id
      AND td.data = _data
      AND td.funcionario_id IN (v_marcela, v_leandro);

  UPDATE public.tarefas_dia SET estado = 'pendente'
    WHERE data = _data AND funcionario_id IN (v_marcela, v_leandro);

  DELETE FROM public.eventos
    WHERE funcionario_id IN (v_marcela, v_leandro)
      AND inicio::date = _data
      AND descricao LIKE '[DEMO]%';
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_dados_demo(date) FROM public;
GRANT EXECUTE ON FUNCTION public.limpar_dados_demo(date) TO authenticated;