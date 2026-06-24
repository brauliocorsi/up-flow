GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_funcionario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tarefa_pertence_a_mim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.questao_visivel(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_my_funcionario(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tarefa_pertence_a_mim(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.questao_visivel(uuid) FROM anon;