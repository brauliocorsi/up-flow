-- 1) Estados e campos novos em eventos
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_estado_chk;
ALTER TABLE public.eventos ADD CONSTRAINT eventos_estado_chk
  CHECK (estado = ANY (ARRAY['aberto'::text,'a_decorrer'::text,'pausado'::text,'fechado'::text]));

ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS iniciado_em timestamptz;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS ordem_fila integer NOT NULL DEFAULT 0;

-- 2) Períodos de atendimento das urgências
CREATE TABLE IF NOT EXISTS public.evento_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evento_execucoes TO authenticated;
GRANT ALL ON public.evento_execucoes TO service_role;

ALTER TABLE public.evento_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evento_execucoes_select" ON public.evento_execucoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.eventos e
    WHERE e.id = evento_id
      AND (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(e.funcionario_id))
  ));

CREATE POLICY "evento_execucoes_insert" ON public.evento_execucoes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.eventos e
    WHERE e.id = evento_id
      AND (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(e.funcionario_id))
  ));

CREATE POLICY "evento_execucoes_update" ON public.evento_execucoes
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.eventos e
    WHERE e.id = evento_id
      AND (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(e.funcionario_id))
  ));

CREATE POLICY "evento_execucoes_delete" ON public.evento_execucoes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'gestor'));

CREATE INDEX IF NOT EXISTS evento_execucoes_evento_idx ON public.evento_execucoes(evento_id);

-- 3) RPCs
CREATE OR REPLACE FUNCTION public.iniciar_urgencia(_evento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_func uuid;
  v_tarefa uuid;
  v_estado text;
  v_outro record;
  v_motivo_urgencia uuid;
  v_exec uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT funcionario_id, estado, tarefa_pausada_id
    INTO v_func, v_estado, v_tarefa
    FROM public.eventos WHERE id = _evento_id;
  IF v_func IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(v_func)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_estado = 'fechado' THEN RAISE EXCEPTION 'evento_fechado'; END IF;
  IF v_estado = 'a_decorrer' THEN RETURN; END IF;

  -- pausar outras urgências em curso do mesmo funcionário
  FOR v_outro IN
    SELECT id FROM public.eventos
     WHERE funcionario_id = v_func AND estado = 'a_decorrer' AND id <> _evento_id
  LOOP
    UPDATE public.evento_execucoes SET fim = now()
      WHERE evento_id = v_outro.id AND fim IS NULL;
    UPDATE public.eventos SET estado = 'pausado' WHERE id = v_outro.id;
  END LOOP;

  -- pausar tarefa em curso
  SELECT id INTO v_tarefa FROM public.tarefas_dia
    WHERE funcionario_id = v_func AND data = CURRENT_DATE AND estado = 'a_decorrer'
    LIMIT 1;
  IF v_tarefa IS NOT NULL THEN
    SELECT id INTO v_motivo_urgencia FROM public.motivos_pausa WHERE label = 'Urgência' LIMIT 1;
    SELECT id INTO v_exec FROM public.execucoes
      WHERE tarefa_dia_id = v_tarefa AND fim IS NULL ORDER BY inicio DESC LIMIT 1;
    IF v_exec IS NOT NULL THEN
      UPDATE public.execucoes SET fim = now(), motivo_pausa_id = v_motivo_urgencia WHERE id = v_exec;
    END IF;
    UPDATE public.tarefas_dia SET estado = 'pausada' WHERE id = v_tarefa;
    UPDATE public.eventos SET tarefa_pausada_id = COALESCE(tarefa_pausada_id, v_tarefa)
      WHERE id = _evento_id;
  END IF;

  INSERT INTO public.evento_execucoes (evento_id) VALUES (_evento_id);
  UPDATE public.eventos
     SET estado = 'a_decorrer',
         iniciado_em = COALESCE(iniciado_em, now()),
         lido = true
   WHERE id = _evento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pausar_urgencia(_evento_id uuid, _motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_func uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT funcionario_id INTO v_func FROM public.eventos WHERE id = _evento_id;
  IF v_func IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(v_func)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.evento_execucoes SET fim = now(), motivo = COALESCE(_motivo, motivo)
    WHERE evento_id = _evento_id AND fim IS NULL;
  UPDATE public.eventos SET estado = 'pausado'
    WHERE id = _evento_id AND estado = 'a_decorrer';
END;
$$;

CREATE OR REPLACE FUNCTION public.retomar_urgencia(_evento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.iniciar_urgencia(_evento_id);
END;
$$;

-- 4) fechar_evento fecha também o período de atendimento
CREATE OR REPLACE FUNCTION public.fechar_evento(_evento_id uuid, _retomar boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_func uuid;
  v_tarefa uuid;
  v_estado_tarefa text;
  v_outra_decorrer uuid;
  v_exec_aberta uuid;
  v_motivo_outro uuid;
  v_nova_exec uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT funcionario_id, tarefa_pausada_id INTO v_func, v_tarefa
    FROM public.eventos WHERE id = _evento_id;
  IF v_func IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  IF NOT (public.has_role(auth.uid(), 'gestor') OR public.is_my_funcionario(v_func)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.evento_execucoes SET fim = now()
    WHERE evento_id = _evento_id AND fim IS NULL;

  UPDATE public.eventos
    SET estado = 'fechado', fim = now(), lido = true
    WHERE id = _evento_id;

  IF _retomar AND v_tarefa IS NOT NULL THEN
    SELECT estado INTO v_estado_tarefa FROM public.tarefas_dia WHERE id = v_tarefa;
    IF v_estado_tarefa = 'pausada' THEN
      SELECT id INTO v_outra_decorrer FROM public.tarefas_dia
        WHERE funcionario_id = v_func AND data = CURRENT_DATE
          AND estado = 'a_decorrer' LIMIT 1;
      IF v_outra_decorrer IS NOT NULL THEN
        SELECT id INTO v_motivo_outro FROM public.motivos_pausa WHERE label = 'Outro' LIMIT 1;
        SELECT id INTO v_exec_aberta FROM public.execucoes
          WHERE tarefa_dia_id = v_outra_decorrer AND fim IS NULL
          ORDER BY inicio DESC LIMIT 1;
        IF v_exec_aberta IS NOT NULL THEN
          UPDATE public.execucoes SET fim = now(), motivo_pausa_id = v_motivo_outro
            WHERE id = v_exec_aberta;
        END IF;
        UPDATE public.tarefas_dia SET estado = 'pausada' WHERE id = v_outra_decorrer;
      END IF;

      INSERT INTO public.execucoes (tarefa_dia_id) VALUES (v_tarefa)
        RETURNING id INTO v_nova_exec;
      UPDATE public.tarefas_dia SET estado = 'a_decorrer' WHERE id = v_tarefa;
      RETURN v_tarefa;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.iniciar_urgencia(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pausar_urgencia(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retomar_urgencia(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fechar_evento(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iniciar_urgencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pausar_urgencia(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retomar_urgencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_evento(uuid, boolean) TO authenticated;