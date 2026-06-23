
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_my_funcionario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tarefa_pertence_a_mim(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_my_funcionario(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tarefa_pertence_a_mim(uuid) TO service_role;
