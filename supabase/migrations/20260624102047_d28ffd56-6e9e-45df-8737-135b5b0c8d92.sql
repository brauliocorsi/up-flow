CREATE OR REPLACE FUNCTION public.definir_papel_funcionario(_funcionario_id uuid, _papel text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _papel NOT IN ('gestor','funcionario') THEN
    RAISE EXCEPTION 'invalid_papel';
  END IF;

  UPDATE public.funcionarios SET papel = _papel WHERE id = _funcionario_id
    RETURNING user_id INTO v_user;

  IF v_user IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user, _papel::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.definir_papel_funcionario(uuid, text) TO authenticated;