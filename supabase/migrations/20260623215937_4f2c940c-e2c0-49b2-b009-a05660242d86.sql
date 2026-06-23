
CREATE TABLE public.macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  atividade_id uuid NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  funcao_id uuid NULL REFERENCES public.funcoes(id) ON DELETE SET NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.macros TO authenticated;
GRANT ALL ON public.macros TO service_role;

ALTER TABLE public.macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "macros_read_auth" ON public.macros
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "macros_insert_gestor" ON public.macros
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "macros_update_gestor" ON public.macros
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "macros_delete_gestor" ON public.macros
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

CREATE INDEX macros_atividade_idx ON public.macros (atividade_id) WHERE atividade_id IS NOT NULL;
CREATE INDEX macros_funcao_idx ON public.macros (funcao_id) WHERE funcao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.macros_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER macros_updated_at
  BEFORE UPDATE ON public.macros
  FOR EACH ROW EXECUTE FUNCTION public.macros_set_updated_at();
