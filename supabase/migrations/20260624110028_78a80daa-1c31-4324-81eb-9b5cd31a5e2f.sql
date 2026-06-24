
INSERT INTO public.horarios_trabalho (funcionario_id, tipo_dia, hora_inicio, hora_fim, ativo)
SELECT f.id, 'util', '09:00'::time, '18:00'::time, true
FROM public.funcionarios f
WHERE f.ativo
  AND NOT EXISTS (SELECT 1 FROM public.horarios_trabalho h WHERE h.funcionario_id=f.id AND h.tipo_dia='util');

INSERT INTO public.horarios_trabalho (funcionario_id, tipo_dia, hora_inicio, hora_fim, ativo)
SELECT f.id, 'sabado', '09:00'::time, '13:00'::time, true
FROM public.funcionarios f
WHERE f.ativo
  AND NOT EXISTS (SELECT 1 FROM public.horarios_trabalho h WHERE h.funcionario_id=f.id AND h.tipo_dia='sabado');

-- Pausa fixa de almoço por defeito em dias úteis (12:30–13:30) se nenhuma existir
INSERT INTO public.pausas_fixas (funcionario_id, tipo_dia, nome, hora_inicio, hora_fim, ordem, ativo)
SELECT f.id, 'util', 'Almoço', '12:30'::time, '13:30'::time, 1, true
FROM public.funcionarios f
WHERE f.ativo
  AND NOT EXISTS (SELECT 1 FROM public.pausas_fixas p WHERE p.funcionario_id=f.id AND p.tipo_dia='util');

SELECT public.migrar_templates_para_blocos();
