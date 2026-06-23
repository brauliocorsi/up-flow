
-- A) Cor por funcionário
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS cor text;

-- Função: escolhe a próxima cor menos usada da paleta fixa
CREATE OR REPLACE FUNCTION public.proxima_cor_funcionario()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_palette text[] := ARRAY[
    '#1D9E75', -- teal
    '#2563EB', -- azul
    '#EF4444', -- coral/vermelho
    '#7C3AED', -- roxo
    '#F59E0B', -- âmbar
    '#16A34A', -- verde
    '#EC4899', -- rosa
    '#6366F1', -- índigo
    '#F97316', -- laranja
    '#475569'  -- cinza-escuro
  ];
  v_color text;
  v_chosen text;
  v_min_count bigint := NULL;
  v_count bigint;
BEGIN
  FOREACH v_color IN ARRAY v_palette LOOP
    SELECT count(*) INTO v_count FROM public.funcionarios WHERE cor = v_color;
    IF v_min_count IS NULL OR v_count < v_min_count THEN
      v_min_count := v_count;
      v_chosen := v_color;
      IF v_count = 0 THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;
  RETURN v_chosen;
END;
$$;

-- Trigger BEFORE INSERT: atribui cor automaticamente quando não fornecida
CREATE OR REPLACE FUNCTION public.set_funcionario_cor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cor IS NULL OR NEW.cor = '' THEN
    NEW.cor := public.proxima_cor_funcionario();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_funcionario_cor ON public.funcionarios;
CREATE TRIGGER trg_funcionario_cor
  BEFORE INSERT ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.set_funcionario_cor();

-- Seed: backfill funcionários existentes sem cor
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id FROM public.funcionarios WHERE cor IS NULL OR cor = '' ORDER BY created_at LOOP
    UPDATE public.funcionarios SET cor = public.proxima_cor_funcionario() WHERE id = rec.id;
  END LOOP;
END $$;
