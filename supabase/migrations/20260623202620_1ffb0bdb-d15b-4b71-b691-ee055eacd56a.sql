
-- Add columns to eventos
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'aberto',
  ADD COLUMN IF NOT EXISTS tarefa_pausada_id uuid REFERENCES public.tarefas_dia(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lido boolean NOT NULL DEFAULT false;

ALTER TABLE public.eventos
  DROP CONSTRAINT IF EXISTS eventos_prioridade_chk;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_prioridade_chk CHECK (prioridade IN ('urgente','normal'));

ALTER TABLE public.eventos
  DROP CONSTRAINT IF EXISTS eventos_estado_chk;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_estado_chk CHECK (estado IN ('aberto','fechado'));

CREATE INDEX IF NOT EXISTS eventos_funcionario_estado_idx
  ON public.eventos (funcionario_id, estado);

-- RPC: gestor dispara urgência (atómico)
CREATE OR REPLACE FUNCTION public.criar_urgencia_gestor(
  _funcionario_id uuid,
  _titulo text,
  _descricao text,
  _prioridade text DEFAULT 'urgente'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento_id uuid;
  v_motivo_urgencia uuid;
  v_tarefa_decorrer uuid;
  v_exec_aberta uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _prioridade NOT IN ('urgente','normal') THEN
    RAISE EXCEPTION 'invalid_prioridade';
  END IF;

  IF _prioridade = 'urgente' THEN
    SELECT id INTO v_motivo_urgencia FROM public.motivos_pausa
      WHERE label = 'Urgência' LIMIT 1;

    SELECT id INTO v_tarefa_decorrer FROM public.tarefas_dia
      WHERE funcionario_id = _funcionario_id
        AND data = CURRENT_DATE
        AND estado = 'a_decorrer'
      LIMIT 1;

    IF v_tarefa_decorrer IS NOT NULL THEN
      SELECT id INTO v_exec_aberta FROM public.execucoes
        WHERE tarefa_dia_id = v_tarefa_decorrer AND fim IS NULL
        ORDER BY inicio DESC LIMIT 1;
      IF v_exec_aberta IS NOT NULL THEN
        UPDATE public.execucoes
          SET fim = now(), motivo_pausa_id = v_motivo_urgencia
          WHERE id = v_exec_aberta;
      END IF;
      UPDATE public.tarefas_dia SET estado = 'pausada' WHERE id = v_tarefa_decorrer;
    END IF;
  END IF;

  INSERT INTO public.eventos (
    funcionario_id, tipo, titulo, descricao, criado_por,
    prioridade, estado, tarefa_pausada_id, lido
  ) VALUES (
    _funcionario_id, 'urgencia', _titulo, COALESCE(_descricao,''), 'gestor',
    _prioridade, 'aberto', v_tarefa_decorrer, false
  ) RETURNING id INTO v_evento_id;

  RETURN v_evento_id;
END;
$$;

-- RPC: fechar evento (com opção de retomar tarefa pausada)
CREATE OR REPLACE FUNCTION public.fechar_evento(
  _evento_id uuid,
  _retomar boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- RPC: marcar eventos como lidos
CREATE OR REPLACE FUNCTION public.marcar_eventos_lidos(_funcionario_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT (public.has_role(auth.uid(), 'gestor') OR public.is_my_funcionario(_funcionario_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.eventos SET lido = true
    WHERE funcionario_id = _funcionario_id AND lido = false;
END;
$$;
