CREATE OR REPLACE FUNCTION public.listar_funcionarios_com_email()
RETURNS TABLE (
  id uuid,
  nome text,
  papel text,
  ativo boolean,
  user_id uuid,
  funcao_id uuid,
  cor text,
  email text,
  setores jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
    SELECT
      f.id,
      f.nome,
      f.papel,
      f.ativo,
      f.user_id,
      f.funcao_id,
      f.cor,
      u.email::text,
      COALESCE(
        jsonb_agg(
          jsonb_build_object('funcao_id', fs.funcao_id)
          ORDER BY fs.funcao_id
        ) FILTER (WHERE fs.funcao_id IS NOT NULL),
        '[]'::jsonb
      ) AS setores
    FROM public.funcionarios f
    LEFT JOIN auth.users u ON u.id = f.user_id
    LEFT JOIN public.funcionario_setores fs ON fs.funcionario_id = f.id
    GROUP BY f.id, u.email
    ORDER BY f.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_funcionarios_com_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_funcionarios_com_email() TO authenticated;