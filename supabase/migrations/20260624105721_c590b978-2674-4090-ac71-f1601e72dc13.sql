
-- 1) Trigger: handle_new_user — auto-create funcionarios + user_roles on first login
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_nome text;
  v_papel text;
  v_func_existente uuid;
BEGIN
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Already linked? do nothing.
  IF EXISTS (SELECT 1 FROM public.funcionarios WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Try to link to an existing funcionario by matching email-derived name? Skip.
  -- Determine papel: emails @upmoveis.pt -> gestor por defeito
  IF v_email LIKE '%@upmoveis.pt' THEN
    v_papel := 'gestor';
  ELSE
    v_papel := 'funcionario';
  END IF;

  -- Derive a default name from metadata or email local part
  v_nome := coalesce(
    NULLIF(NEW.raw_user_meta_data->>'full_name',''),
    NULLIF(NEW.raw_user_meta_data->>'name',''),
    initcap(replace(split_part(v_email,'@',1), '.', ' '))
  );

  -- If there's a funcionario with no user_id but matching name (case-insensitive), link it
  SELECT id INTO v_func_existente
  FROM public.funcionarios
  WHERE user_id IS NULL AND lower(nome) = lower(v_nome)
  LIMIT 1;

  IF v_func_existente IS NOT NULL THEN
    UPDATE public.funcionarios
      SET user_id = NEW.id, papel = v_papel, ativo = true
      WHERE id = v_func_existente;
  ELSE
    INSERT INTO public.funcionarios (nome, user_id, papel, ativo)
    VALUES (v_nome, NEW.id, v_papel, true);
  END IF;

  -- Sync user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_papel::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Backfill: sync user_roles to match funcionarios.papel for all linked users
INSERT INTO public.user_roles (user_id, role)
SELECT f.user_id, f.papel::app_role
FROM public.funcionarios f
WHERE f.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove stale roles that don't match funcionarios.papel
DELETE FROM public.user_roles ur
USING public.funcionarios f
WHERE ur.user_id = f.user_id
  AND ur.role::text <> f.papel;

-- 3) Backfill: any auth.users without funcionario, with @upmoveis.pt email -> gestor
INSERT INTO public.funcionarios (nome, user_id, papel, ativo)
SELECT
  initcap(replace(split_part(lower(u.email),'@',1), '.', ' ')),
  u.id,
  CASE WHEN lower(u.email) LIKE '%@upmoveis.pt' THEN 'gestor' ELSE 'funcionario' END,
  true
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.funcionarios f WHERE f.user_id = u.id);

INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
  (CASE WHEN lower(u.email) LIKE '%@upmoveis.pt' THEN 'gestor' ELSE 'funcionario' END)::app_role
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;
