CREATE TABLE public.rotina_blocos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  dia_semana int NOT NULL CHECK (dia_semana BETWEEN 1 AND 6),
  atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE RESTRICT,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rotina_blocos_horas_chk CHECK (hora_inicio < hora_fim)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotina_blocos TO authenticated;
GRANT ALL ON public.rotina_blocos TO service_role;

ALTER TABLE public.rotina_blocos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestor manage rotina_blocos" ON public.rotina_blocos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'gestor'));

CREATE POLICY "funcionario read own rotina_blocos" ON public.rotina_blocos
  FOR SELECT TO authenticated
  USING (public.is_my_funcionario(funcionario_id));

CREATE INDEX idx_rotina_blocos_func_dia
  ON public.rotina_blocos(funcionario_id, dia_semana, hora_inicio);

CREATE OR REPLACE FUNCTION public.rotina_blocos_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_rotina_blocos_updated_at
  BEFORE UPDATE ON public.rotina_blocos
  FOR EACH ROW EXECUTE FUNCTION public.rotina_blocos_set_updated_at();

CREATE OR REPLACE FUNCTION public.copiar_rotina_dia(
  _funcionario_id uuid,
  _dia_origem int,
  _dias_destino int[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  d int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOREACH d IN ARRAY _dias_destino LOOP
    IF d = _dia_origem THEN CONTINUE; END IF;
    IF d < 1 OR d > 6 THEN CONTINUE; END IF;
    DELETE FROM public.rotina_blocos
      WHERE funcionario_id = _funcionario_id AND dia_semana = d;
    INSERT INTO public.rotina_blocos
      (funcionario_id, dia_semana, atividade_id, hora_inicio, hora_fim, ordem)
    SELECT funcionario_id, d, atividade_id, hora_inicio, hora_fim, ordem
      FROM public.rotina_blocos
      WHERE funcionario_id = _funcionario_id AND dia_semana = _dia_origem;
  END LOOP;
END; $$;