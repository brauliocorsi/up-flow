-- Read-only security regression checks. No fixtures or production report writes.
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename IN ('reportes','reporte_eventos') AND cmd='SELECT' AND qual='true';
 IF n<>0 THEN RAISE EXCEPTION 'Unrestricted report/event SELECT policy'; END IF;
 IF has_table_privilege('authenticated','public.reportes','UPDATE') THEN RAISE EXCEPTION 'Staff can bypass transactional mutations'; END IF;
 IF has_table_privilege('authenticated','public.reporte_respostas_individuais','INSERT') THEN RAISE EXCEPTION 'Direct individual response INSERT bypass'; END IF;
 IF has_function_privilege('anon','public.central_submeter(text,jsonb,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'Anonymous submission enabled'; END IF;
 IF has_function_privilege('authenticated','public.central_notificar(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Arbitrary notification enabled'; END IF;
 IF has_column_privilege('authenticated','public.reportes','responsaveis_apurados','SELECT') THEN RAISE EXCEPTION 'Staff can read adjudicated individual responsibility'; END IF;
 IF has_column_privilege('authenticated','public.reportes','evidencia_apuracao','SELECT') THEN RAISE EXCEPTION 'Staff can read private investigation evidence'; END IF;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd IN('INSERT','UPDATE','DELETE') AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%central-reportes%';
 IF n<>0 THEN RAISE EXCEPTION 'Browser bypass of validated uploads'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='reporte_respostas_individuais' AND qual LIKE '%autor_id%' AND qual LIKE '%central_gestor%') THEN RAISE EXCEPTION 'Missing private response owner/manager policy'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.reporte_eventos'::regclass AND tgname='central_eventos_imutaveis') THEN RAISE EXCEPTION 'Missing append-only event guard'; END IF;
 IF position('r.corrigido_por=eu' in pg_get_functiondef('public.rc_mudar_estado(uuid,text,text,date)'::regprocedure))=0 THEN RAISE EXCEPTION 'Missing separate validator rule'; END IF;
 IF position('new.erro_confirmado' in pg_get_functiondef('public.central_abertura_segura()'::regprocedure))=0 THEN RAISE EXCEPTION 'Opening permits adjudicated guilt'; END IF;
 RAISE NOTICE 'PASS: 11 security structure checks; no rows created';
END $$;
