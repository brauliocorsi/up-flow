
-- Revoke from PUBLIC and anon for all SECURITY DEFINER functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
  END LOOP;
END $$;

-- Revoke from authenticated for internal-only helpers (used inside RLS policies / other functions)
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_my_funcionario(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.tarefa_pertence_a_mim(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.questao_visivel(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.proxima_cor_funcionario() FROM authenticated;

-- Revoke from authenticated for trigger functions (only invoked by triggers)
REVOKE ALL ON FUNCTION public.set_funcionario_cor() FROM authenticated;
REVOKE ALL ON FUNCTION public.macros_set_updated_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.horarios_set_updated_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.questoes_set_updated_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.rotina_blocos_set_updated_at() FROM authenticated;
