
-- =========================================
-- (A) funcionario_setores
-- =========================================
CREATE TABLE public.funcionario_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  funcao_id uuid NOT NULL REFERENCES public.funcoes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, funcao_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionario_setores TO authenticated;
GRANT ALL ON public.funcionario_setores TO service_role;

ALTER TABLE public.funcionario_setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read funcionario_setores"
  ON public.funcionario_setores FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "gestor insert funcionario_setores"
  ON public.funcionario_setores FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "gestor update funcionario_setores"
  ON public.funcionario_setores FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "gestor delete funcionario_setores"
  ON public.funcionario_setores FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE INDEX idx_funcionario_setores_func ON public.funcionario_setores(funcionario_id);
CREATE INDEX idx_funcionario_setores_setor ON public.funcionario_setores(funcao_id);

-- Migração: preencher com o setor atual de cada funcionário
INSERT INTO public.funcionario_setores (funcionario_id, funcao_id)
SELECT f.id, f.funcao_id
FROM public.funcionarios f
WHERE f.funcao_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- funcao_id passa a ser opcional (continua a apontar para o "setor principal")
ALTER TABLE public.funcionarios ALTER COLUMN funcao_id DROP NOT NULL;

-- =========================================
-- (B) atividades — biblioteca por setor
-- =========================================
CREATE TABLE public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_id uuid NOT NULL REFERENCES public.funcoes(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  duracao_padrao_min integer NOT NULL DEFAULT 30 CHECK (duracao_padrao_min >= 0),
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcao_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades TO authenticated;
GRANT ALL ON public.atividades TO service_role;

ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read atividades"
  ON public.atividades FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "gestor insert atividades"
  ON public.atividades FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "gestor update atividades"
  ON public.atividades FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "gestor delete atividades"
  ON public.atividades FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE INDEX idx_atividades_setor ON public.atividades(funcao_id);

-- Seed a partir dos template_tarefas existentes
-- Por (setor, nome) escolhe a duração mais comum (moda) — usa AVG como aproximação simples
INSERT INTO public.atividades (funcao_id, nome, descricao, duracao_padrao_min, ativo)
SELECT
  rt.funcao_id,
  tt.titulo AS nome,
  COALESCE(MAX(NULLIF(tt.descricao, '')), '') AS descricao,
  ROUND(AVG(tt.minutos_previstos))::int AS duracao_padrao_min,
  true
FROM public.template_tarefas tt
JOIN public.rotina_templates rt ON rt.id = tt.template_id
GROUP BY rt.funcao_id, tt.titulo
ON CONFLICT (funcao_id, nome) DO NOTHING;
