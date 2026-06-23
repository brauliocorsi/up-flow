
-- (0) UNIQUE constraint on rotina_templates
ALTER TABLE public.rotina_templates
  ADD CONSTRAINT rotina_templates_funcao_dia_unique UNIQUE (funcao_id, dia_semana);

-- (2) listar_users_nao_associados — só gestor
CREATE OR REPLACE FUNCTION public.listar_users_nao_associados()
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email::text
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.funcionarios f WHERE f.user_id = u.id
    )
    ORDER BY u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_users_nao_associados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_users_nao_associados() TO authenticated;

-- associar_user_a_funcionario — só gestor; também garante user_roles
CREATE OR REPLACE FUNCTION public.associar_user_a_funcionario(
  _funcionario_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_papel text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF EXISTS (SELECT 1 FROM public.funcionarios WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'user_already_linked';
  END IF;

  UPDATE public.funcionarios SET user_id = _user_id WHERE id = _funcionario_id
  RETURNING papel INTO v_papel;

  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'funcionario_not_found';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, v_papel::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.associar_user_a_funcionario(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.associar_user_a_funcionario(uuid, uuid) TO authenticated;

-- desassociar_user_de_funcionario — só gestor; limpa user_id e remove user_roles
CREATE OR REPLACE FUNCTION public.desassociar_user_de_funcionario(_funcionario_id uuid)
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

  SELECT user_id INTO v_user FROM public.funcionarios WHERE id = _funcionario_id;
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.funcionarios SET user_id = NULL WHERE id = _funcionario_id;
  DELETE FROM public.user_roles WHERE user_id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.desassociar_user_de_funcionario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desassociar_user_de_funcionario(uuid) TO authenticated;

-- funcionario_tem_historico — usada pela UI para decidir apagar vs desativar
CREATE OR REPLACE FUNCTION public.funcionario_tem_historico(_funcionario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.tarefas_dia WHERE funcionario_id = _funcionario_id)
      OR EXISTS (SELECT 1 FROM public.eventos WHERE funcionario_id = _funcionario_id);
$$;

REVOKE ALL ON FUNCTION public.funcionario_tem_historico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.funcionario_tem_historico(uuid) TO authenticated;

-- (3) Seed Marcela & Leandro (idempotente por nome)
INSERT INTO public.funcionarios (funcao_id, nome, papel, ativo)
SELECT f.id, 'Marcela', 'funcionario', true
FROM public.funcoes f
WHERE f.nome = 'Apoio/Vendas/Compras'
  AND NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE nome = 'Marcela');

INSERT INTO public.funcionarios (funcao_id, nome, papel, ativo)
SELECT f.id, 'Leandro', 'funcionario', true
FROM public.funcoes f
WHERE f.nome = 'Armazém/Logística'
  AND NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE nome = 'Leandro');
