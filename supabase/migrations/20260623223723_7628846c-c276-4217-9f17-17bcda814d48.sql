
-- Tables: horarios_trabalho and pausas_fixas
CREATE TABLE public.horarios_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_dia text NOT NULL CHECK (tipo_dia IN ('util','sabado')),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, tipo_dia),
  CHECK (hora_inicio < hora_fim)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.horarios_trabalho TO authenticated;
GRANT ALL ON public.horarios_trabalho TO service_role;

ALTER TABLE public.horarios_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestor manage horarios" ON public.horarios_trabalho
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'gestor'));

CREATE POLICY "funcionario read own horario" ON public.horarios_trabalho
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(funcionario_id));

CREATE TABLE public.pausas_fixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_dia text NOT NULL CHECK (tipo_dia IN ('util','sabado')),
  nome text NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hora_inicio < hora_fim)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pausas_fixas TO authenticated;
GRANT ALL ON public.pausas_fixas TO service_role;

ALTER TABLE public.pausas_fixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestor manage pausas" ON public.pausas_fixas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'gestor'));

CREATE POLICY "funcionario read own pausas" ON public.pausas_fixas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.is_my_funcionario(funcionario_id));

CREATE OR REPLACE FUNCTION public.horarios_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER horarios_trabalho_updated_at
  BEFORE UPDATE ON public.horarios_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.horarios_set_updated_at();

-- Seed: aplicar horários e almoço aos funcionários ativos que não os tenham
INSERT INTO public.horarios_trabalho (funcionario_id, tipo_dia, hora_inicio, hora_fim)
SELECT f.id, 'util', '08:00'::time, '17:30'::time
FROM public.funcionarios f
WHERE f.ativo = true
  AND NOT EXISTS (SELECT 1 FROM public.horarios_trabalho h WHERE h.funcionario_id = f.id AND h.tipo_dia = 'util');

INSERT INTO public.horarios_trabalho (funcionario_id, tipo_dia, hora_inicio, hora_fim)
SELECT f.id, 'sabado', '09:00'::time, '12:00'::time
FROM public.funcionarios f
WHERE f.ativo = true
  AND NOT EXISTS (SELECT 1 FROM public.horarios_trabalho h WHERE h.funcionario_id = f.id AND h.tipo_dia = 'sabado');

INSERT INTO public.pausas_fixas (funcionario_id, tipo_dia, nome, hora_inicio, hora_fim, ordem)
SELECT f.id, 'util', 'Almoço', '12:00'::time, '14:00'::time, 0
FROM public.funcionarios f
WHERE f.ativo = true
  AND NOT EXISTS (SELECT 1 FROM public.pausas_fixas p WHERE p.funcionario_id = f.id AND p.tipo_dia = 'util' AND p.nome = 'Almoço');
