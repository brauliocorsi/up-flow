
-- =========================
-- TABLE: questoes
-- =========================
CREATE TABLE public.questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  atividade_id uuid REFERENCES public.atividades(id) ON DELETE SET NULL,
  tarefa_dia_id uuid REFERENCES public.tarefas_dia(id) ON DELETE SET NULL,
  assunto text NOT NULL,
  tipo text NOT NULL DEFAULT 'duvida',
  estado text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT questoes_tipo_chk CHECK (tipo IN ('duvida','autorizacao')),
  CONSTRAINT questoes_estado_chk CHECK (estado IN ('aberta','respondida','fechada'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questoes TO authenticated;
GRANT ALL ON public.questoes TO service_role;

ALTER TABLE public.questoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questoes_select_gestor_or_owner" ON public.questoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(funcionario_id));

CREATE POLICY "questoes_insert_owner" ON public.questoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_funcionario(funcionario_id));

CREATE POLICY "questoes_update_gestor_or_owner" ON public.questoes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(funcionario_id))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(funcionario_id));

CREATE POLICY "questoes_delete_gestor" ON public.questoes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'gestor'));

CREATE INDEX questoes_funcionario_idx ON public.questoes(funcionario_id);
CREATE INDEX questoes_estado_idx ON public.questoes(estado);

-- =========================
-- TABLE: questao_mensagens
-- =========================
CREATE TABLE public.questao_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questao_id uuid NOT NULL REFERENCES public.questoes(id) ON DELETE CASCADE,
  autor_funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  autor_papel text NOT NULL,
  texto text NOT NULL,
  lida_pelo_gestor boolean NOT NULL DEFAULT false,
  lida_pelo_operador boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qmsg_papel_chk CHECK (autor_papel IN ('operador','gestor'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questao_mensagens TO authenticated;
GRANT ALL ON public.questao_mensagens TO service_role;

ALTER TABLE public.questao_mensagens ENABLE ROW LEVEL SECURITY;

-- helper: can current user see this questao?
CREATE OR REPLACE FUNCTION public.questao_visivel(_questao_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.questoes q
    WHERE q.id = _questao_id
      AND (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(q.funcionario_id))
  );
$$;

CREATE POLICY "qmsg_select_visible" ON public.questao_mensagens
  FOR SELECT TO authenticated
  USING (public.questao_visivel(questao_id));

CREATE POLICY "qmsg_insert_author" ON public.questao_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    public.questao_visivel(questao_id)
    AND public.is_my_funcionario(autor_funcionario_id)
    AND (
      (autor_papel = 'gestor' AND public.has_role(auth.uid(),'gestor'))
      OR (autor_papel = 'operador')
    )
  );

CREATE POLICY "qmsg_update_read_flags" ON public.questao_mensagens
  FOR UPDATE TO authenticated
  USING (public.questao_visivel(questao_id))
  WITH CHECK (public.questao_visivel(questao_id));

CREATE INDEX qmsg_questao_idx ON public.questao_mensagens(questao_id);

-- =========================
-- updated_at trigger for questoes
-- =========================
CREATE OR REPLACE FUNCTION public.questoes_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_questoes_updated_at
  BEFORE UPDATE ON public.questoes
  FOR EACH ROW EXECUTE FUNCTION public.questoes_set_updated_at();

-- =========================
-- Realtime
-- =========================
ALTER TABLE public.questoes REPLICA IDENTITY FULL;
ALTER TABLE public.questao_mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questao_mensagens;
