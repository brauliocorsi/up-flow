
DO $$
DECLARE
  v_avc uuid;
  v_arm uuid;
  v_template uuid;
  d int;
BEGIN
  SELECT id INTO v_avc FROM public.funcoes WHERE nome = 'Apoio/Vendas/Compras';
  SELECT id INTO v_arm FROM public.funcoes WHERE nome = 'Armazém/Logística';

  -- Apoio/Vendas/Compras seg–sex
  FOR d IN 1..5 LOOP
    INSERT INTO public.rotina_templates (funcao_id, dia_semana) VALUES (v_avc, d) RETURNING id INTO v_template;
    INSERT INTO public.template_tarefas (template_id, titulo, ordem, minutos_previstos, tipo) VALUES
      (v_template, 'Arranque do dia', 1, 15, 'rotina'),
      (v_template, 'E-mails de apoio ao cliente', 2, 45, 'rotina'),
      (v_template, 'Respond — mensagens bloco 1', 3, 60, 'rotina'),
      (v_template, 'Confirmações de venda por telefone', 4, 60, 'rotina'),
      (v_template, 'Compras — disparar e-mails a fornecedores', 5, CASE WHEN d=4 THEN 90 ELSE 45 END, 'rotina'),
      (v_template, 'Vendas WooCommerce→GestãoClick', 6, 60, 'rotina'),
      (v_template, 'Respond — mensagens bloco 2', 7, 45, 'rotina'),
      (v_template, 'Acompanhamento de fornecedores', 8, 60, 'rotina'),
      (v_template, 'Respond + e-mails — limpeza final', 9, 30, 'rotina'),
      (v_template, 'Fecho + registo do dia', 10, 15, 'rotina');
    IF d = 5 THEN
      UPDATE public.template_tarefas SET ordem = 11 WHERE template_id = v_template AND ordem = 10;
      INSERT INTO public.template_tarefas (template_id, titulo, ordem, minutos_previstos, tipo) VALUES
        (v_template, '5S — organização semanal', 10, 45, 'rotina');
    END IF;
  END LOOP;

  -- Apoio/Vendas/Compras sábado
  INSERT INTO public.rotina_templates (funcao_id, dia_semana) VALUES (v_avc, 6) RETURNING id INTO v_template;
  INSERT INTO public.template_tarefas (template_id, titulo, ordem, minutos_previstos, tipo) VALUES
    (v_template, 'Arranque', 1, 15, 'rotina'),
    (v_template, 'E-mails de apoio + Respond', 2, 60, 'rotina'),
    (v_template, 'Vendas + confirmações', 3, 75, 'rotina'),
    (v_template, 'Compras + fecho da semana', 4, 45, 'rotina');

  -- Armazém segunda
  INSERT INTO public.rotina_templates (funcao_id, dia_semana) VALUES (v_arm, 1) RETURNING id INTO v_template;
  INSERT INTO public.template_tarefas (template_id, titulo, ordem, minutos_previstos, tipo) VALUES
    (v_template, 'Lista de picking (rota de terça)', 1, 10, 'rotina'),
    (v_template, 'Conferência de nova entrada / levantamento', 2, 5, 'rotina'),
    (v_template, 'Organização do armazém / conferência de stock físico', 3, 30, 'rotina'),
    (v_template, 'Formulário de assistência', 4, 15, 'rotina'),
    (v_template, 'Separação da rota de terça', 5, 120, 'rotina'),
    (v_template, 'Conferência de rota', 6, 30, 'rotina'),
    (v_template, 'Organização do armazém + eventos', 7, 180, 'rotina'),
    (v_template, 'Produtos para cadastro no contagem', 8, 30, 'rotina'),
    (v_template, 'Transferência fábrica→stock', 9, 30, 'rotina');

  -- Armazém ter–sex
  FOR d IN 2..5 LOOP
    INSERT INTO public.rotina_templates (funcao_id, dia_semana) VALUES (v_arm, d) RETURNING id INTO v_template;
    INSERT INTO public.template_tarefas (template_id, titulo, ordem, minutos_previstos, tipo) VALUES
      (v_template, 'Lista de picking no programa de contagem', 1, 10, 'rotina'),
      (v_template, 'Conferência de nova entrada na rota / levantamento do dia', 2, 5, 'rotina'),
      (v_template, 'Carregamento da carrinha', 3, 30, 'rotina'),
      (v_template, 'Formulário de assistência', 4, 15, 'rotina'),
      (v_template, 'Separação da rota do dia seguinte', 5, 120, 'rotina'),
      (v_template, 'Conferência de rota — sentido, marcações, tempo', 6, 30, 'rotina'),
      (v_template, 'Organização do armazém + eventos', 7, 180, 'rotina'),
      (v_template, 'Produtos para cadastro no contagem', 8, 30, 'rotina'),
      (v_template, 'Transferência fábrica→stock', 9, 30, 'rotina');
    IF d = 5 THEN
      UPDATE public.template_tarefas SET ordem = 10 WHERE template_id = v_template AND ordem = 9;
      INSERT INTO public.template_tarefas (template_id, titulo, ordem, minutos_previstos, tipo) VALUES
        (v_template, '5S — limpeza profunda do armazém', 9, 30, 'rotina');
    END IF;
  END LOOP;

  -- Armazém sábado
  INSERT INTO public.rotina_templates (funcao_id, dia_semana) VALUES (v_arm, 6) RETURNING id INTO v_template;
  INSERT INTO public.template_tarefas (template_id, titulo, ordem, minutos_previstos, tipo) VALUES
    (v_template, 'Lista de picking', 1, 10, 'rotina'),
    (v_template, 'Conferência de nova entrada / levantamento', 2, 5, 'rotina'),
    (v_template, 'Carregamento da carrinha', 3, 30, 'rotina'),
    (v_template, 'Formulário de assistência', 4, 15, 'rotina'),
    (v_template, 'Separação da rota de terça', 5, 60, 'rotina'),
    (v_template, 'Conferência de rota', 6, 30, 'rotina'),
    (v_template, 'Transferência fábrica→stock + fecho', 7, 30, 'rotina');
END $$;

-- Geração diária idempotente
CREATE OR REPLACE FUNCTION public.gerar_tarefas_do_dia(_funcionario_id uuid, _data date)
RETURNS TABLE (id uuid, titulo text, ordem int, minutos_previstos int, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow int;
  v_funcao_id uuid;
  v_template_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'gestor') OR public.is_my_funcionario(_funcionario_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_dow := EXTRACT(ISODOW FROM _data)::int;
  IF v_dow = 7 THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.tarefas_dia td WHERE td.funcionario_id = _funcionario_id AND td.data = _data) THEN
    RETURN QUERY
      SELECT td.id, td.titulo, td.ordem, td.minutos_previstos, td.estado
      FROM public.tarefas_dia td
      WHERE td.funcionario_id = _funcionario_id AND td.data = _data
      ORDER BY td.ordem;
    RETURN;
  END IF;

  SELECT f.funcao_id INTO v_funcao_id
  FROM public.funcionarios f
  WHERE f.id = _funcionario_id AND f.ativo = true;
  IF v_funcao_id IS NULL THEN
    RETURN;
  END IF;

  SELECT rt.id INTO v_template_id
  FROM public.rotina_templates rt
  WHERE rt.funcao_id = v_funcao_id AND rt.dia_semana = v_dow
  LIMIT 1;
  IF v_template_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.tarefas_dia (funcionario_id, data, template_tarefa_id, titulo, ordem, minutos_previstos, estado)
  SELECT _funcionario_id, _data, tt.id, tt.titulo, tt.ordem, tt.minutos_previstos, 'pendente'
  FROM public.template_tarefas tt
  WHERE tt.template_id = v_template_id;

  RETURN QUERY
    SELECT td.id, td.titulo, td.ordem, td.minutos_previstos, td.estado
    FROM public.tarefas_dia td
    WHERE td.funcionario_id = _funcionario_id AND td.data = _data
    ORDER BY td.ordem;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_tarefas_do_dia(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_tarefas_do_dia(uuid, date) TO authenticated;
