
-- ========== ENUM de roles ==========
CREATE TYPE public.app_role AS ENUM ('gestor', 'funcionario');

-- ========== user_roles ==========
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ========== funcoes ==========
CREATE TABLE public.funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes TO authenticated;
GRANT ALL ON public.funcoes TO service_role;
ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read funcoes" ON public.funcoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor write funcoes" ON public.funcoes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor update funcoes" ON public.funcoes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor delete funcoes" ON public.funcoes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

-- ========== funcionarios ==========
CREATE TABLE public.funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_id uuid REFERENCES public.funcoes(id) ON DELETE SET NULL,
  nome text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('gestor','funcionario')),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios TO authenticated;
GRANT ALL ON public.funcionarios TO service_role;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- helper: is the given funcionario_id linked to current auth user?
CREATE OR REPLACE FUNCTION public.is_my_funcionario(_funcionario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = _funcionario_id AND user_id = auth.uid()
  )
$$;

CREATE POLICY "Self read funcionarios" ON public.funcionarios
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor insert funcionarios" ON public.funcionarios
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor update funcionarios" ON public.funcionarios
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor delete funcionarios" ON public.funcionarios
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

-- ========== rotina_templates ==========
CREATE TABLE public.rotina_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_id uuid NOT NULL REFERENCES public.funcoes(id) ON DELETE CASCADE,
  dia_semana int NOT NULL CHECK (dia_semana BETWEEN 1 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcao_id, dia_semana)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotina_templates TO authenticated;
GRANT ALL ON public.rotina_templates TO service_role;
ALTER TABLE public.rotina_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read templates" ON public.rotina_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manage templates" ON public.rotina_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ========== template_tarefas ==========
CREATE TABLE public.template_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.rotina_templates(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  ordem int NOT NULL DEFAULT 0,
  minutos_previstos int NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'rotina' CHECK (tipo IN ('rotina','evento_planeado')),
  hora_sugerida text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_tarefas TO authenticated;
GRANT ALL ON public.template_tarefas TO service_role;
ALTER TABLE public.template_tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read template_tarefas" ON public.template_tarefas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manage template_tarefas" ON public.template_tarefas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ========== motivos_pausa ==========
CREATE TABLE public.motivos_pausa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_pausa TO authenticated;
GRANT ALL ON public.motivos_pausa TO service_role;
ALTER TABLE public.motivos_pausa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read motivos_pausa" ON public.motivos_pausa
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manage motivos_pausa" ON public.motivos_pausa
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ========== tarefas_dia ==========
CREATE TABLE public.tarefas_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  template_tarefa_id uuid REFERENCES public.template_tarefas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  minutos_previstos int NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendente'
    CHECK (estado IN ('pendente','a_decorrer','pausada','saltada','concluida')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_dia TO authenticated;
GRANT ALL ON public.tarefas_dia TO service_role;
ALTER TABLE public.tarefas_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Self/gestor read tarefas_dia" ON public.tarefas_dia
  FOR SELECT TO authenticated
  USING (public.is_my_funcionario(funcionario_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Self/gestor insert tarefas_dia" ON public.tarefas_dia
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_funcionario(funcionario_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Self/gestor update tarefas_dia" ON public.tarefas_dia
  FOR UPDATE TO authenticated
  USING (public.is_my_funcionario(funcionario_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor delete tarefas_dia" ON public.tarefas_dia
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

-- ========== execucoes ==========
CREATE TABLE public.execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_dia_id uuid NOT NULL REFERENCES public.tarefas_dia(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  motivo_pausa_id uuid REFERENCES public.motivos_pausa(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execucoes TO authenticated;
GRANT ALL ON public.execucoes TO service_role;
ALTER TABLE public.execucoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tarefa_pertence_a_mim(_tarefa_dia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tarefas_dia td
    JOIN public.funcionarios f ON f.id = td.funcionario_id
    WHERE td.id = _tarefa_dia_id AND f.user_id = auth.uid()
  )
$$;

CREATE POLICY "Self/gestor read execucoes" ON public.execucoes
  FOR SELECT TO authenticated
  USING (public.tarefa_pertence_a_mim(tarefa_dia_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Self/gestor insert execucoes" ON public.execucoes
  FOR INSERT TO authenticated
  WITH CHECK (public.tarefa_pertence_a_mim(tarefa_dia_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Self/gestor update execucoes" ON public.execucoes
  FOR UPDATE TO authenticated
  USING (public.tarefa_pertence_a_mim(tarefa_dia_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor delete execucoes" ON public.execucoes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

-- ========== eventos ==========
CREATE TABLE public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('recebimento','levantamento','urgencia','outro')),
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  criado_por text NOT NULL CHECK (criado_por IN ('funcionario','gestor')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos TO authenticated;
GRANT ALL ON public.eventos TO service_role;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Self/gestor read eventos" ON public.eventos
  FOR SELECT TO authenticated
  USING (public.is_my_funcionario(funcionario_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Self/gestor insert eventos" ON public.eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_funcionario(funcionario_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Self/gestor update eventos" ON public.eventos
  FOR UPDATE TO authenticated
  USING (public.is_my_funcionario(funcionario_id) OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor delete eventos" ON public.eventos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

-- ========== SEED ==========
INSERT INTO public.funcoes (nome) VALUES
  ('Apoio/Vendas/Compras'),
  ('Armazém/Logística');

INSERT INTO public.motivos_pausa (label) VALUES
  ('Almoço'),
  ('Recebimento de fornecedor'),
  ('Levantamento de cliente'),
  ('Urgência'),
  ('Pausa pessoal'),
  ('Outro');
