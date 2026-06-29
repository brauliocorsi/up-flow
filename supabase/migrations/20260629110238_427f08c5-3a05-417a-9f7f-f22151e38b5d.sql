GRANT SELECT, INSERT, UPDATE, DELETE ON public.horarios_trabalho TO authenticated;
GRANT ALL ON public.horarios_trabalho TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pausas_fixas TO authenticated;
GRANT ALL ON public.pausas_fixas TO service_role;