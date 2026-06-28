
-- Revoke default public EXECUTE on all functions in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END$$;

-- Grant EXECUTE to authenticated only on functions invoked by client (RPC) or RLS policies
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_funcionario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tarefa_pertence_a_mim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.questao_visivel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.funcionario_tem_historico(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.gerar_tarefas_do_dia(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_evento(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_eventos_lidos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_urgencia_gestor(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copiar_rotina_dia(uuid, integer, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_papel_funcionario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.associar_user_a_funcionario(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desassociar_user_de_funcionario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_users_nao_associados() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_dados_demo(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_dados_demo(date) TO authenticated;
