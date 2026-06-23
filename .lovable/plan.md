## UP Móveis — Fundação (BD + Auth + i18n)

Vou criar a base de dados, autenticação e esqueleto mínimo da app. Sem ecrãs de funcionalidades — apenas login e uma página pós-login que mostra o nome e papel do utilizador.

### 1. Lovable Cloud
Ativar o Lovable Cloud (Supabase gerido) para ter base de dados + autenticação sem configuração externa.

### 2. Base de dados (migração SQL)

**Tabelas** (todas com `id uuid default gen_random_uuid()` e `created_at timestamptz default now()`):

- `funcoes` — id, nome
- `funcionarios` — id, funcao_id→funcoes, nome, papel ('gestor'|'funcionario'), user_id→auth.users (nullable, unique), ativo (bool default true)
- `rotina_templates` — id, funcao_id→funcoes, dia_semana (1–6)
- `template_tarefas` — id, template_id→rotina_templates, titulo, descricao, ordem, minutos_previstos, tipo ('rotina'|'evento_planeado'), hora_sugerida (text nullable)
- `tarefas_dia` — id, funcionario_id→funcionarios, data, template_tarefa_id→template_tarefas (nullable), titulo, ordem, minutos_previstos, estado ('pendente'|'a_decorrer'|'pausada'|'saltada'|'concluida' default 'pendente')
- `motivos_pausa` — id, label, ativo (bool default true)
- `execucoes` — id, tarefa_dia_id→tarefas_dia, inicio, fim (nullable), motivo_pausa_id→motivos_pausa (nullable)
- `eventos` — id, funcionario_id→funcionarios, tipo ('recebimento'|'levantamento'|'urgencia'|'outro'), titulo, descricao, inicio, fim (nullable), criado_por ('funcionario'|'gestor')

**GRANTs**: cada tabela recebe `GRANT SELECT/INSERT/UPDATE/DELETE … TO authenticated` e `GRANT ALL … TO service_role`.

**RLS — abordagem segura (sem recursão)**

Para evitar misturar papéis na própria tabela `funcionarios` (risco de escalada e recursão de RLS), o papel "gestor" passa para a tabela canónica de roles:

- `app_role` enum: `'gestor' | 'funcionario'`
- `user_roles(user_id, role)` com RLS e função `has_role(_user_id, _role)` SECURITY DEFINER
- A coluna `funcionarios.papel` mantém-se (é útil para listagens), mas as policies usam SEMPRE `has_role(auth.uid(), 'gestor')`.
- Função auxiliar `is_my_funcionario(_funcionario_id)` SECURITY DEFINER que devolve true se `funcionarios.user_id = auth.uid()`.

**Policies por tabela** (resumo):
- `funcoes`, `motivos_pausa`, `rotina_templates`, `template_tarefas`: SELECT para `authenticated`; INSERT/UPDATE/DELETE apenas para gestor.
- `funcionarios`: gestor full; funcionário SELECT só da própria linha.
- `user_roles`: SELECT da própria linha + gestor full.
- `tarefas_dia`, `execucoes` (via tarefa_dia), `eventos`: gestor full; funcionário CRUD apenas onde `is_my_funcionario(funcionario_id)`.

**Seed**
- Funções: "Apoio/Vendas/Compras", "Armazém/Logística".
- Motivos de pausa: Almoço, Recebimento de fornecedor, Levantamento de cliente, Urgência, Pausa pessoal, Outro.

### 3. Auth + ligação a `funcionarios`

- Login email/password via Supabase Auth (sem confirmação de email para facilitar testes).
- Sem fluxo de signup público nesta fase (os funcionários são criados pelo gestor mais tarde). Para destrancar o desenvolvimento, documento como ligar manualmente: criar um utilizador em Cloud → Users, depois `UPDATE funcionarios SET user_id = '…'` e inserir em `user_roles`. Posso opcionalmente incluir um botão "Criar conta" simples agora se preferires (ver pergunta abaixo).
- Rota `/auth` pública com formulário de login.
- Trigger ao registar para criar linha em `funcionarios` automaticamente? **Não** nesta fase — o gestor é quem associa user_id a um funcionário existente. Evita registos órfãos.

### 4. Esqueleto da app (TanStack Start)

- `src/routes/auth.tsx` — página de login (pública).
- `src/routes/_authenticated/route.tsx` — gate gerido pela integração (já trata do redirect para `/auth`).
- `src/routes/_authenticated/index.tsx` — página pós-login: lê `funcionarios` por `user_id = auth.uid()` e mostra "Olá, {nome} — {papel}". Se não houver linha associada, mostra mensagem "Conta ainda não associada a um funcionário".
- `src/routes/index.tsx` — redirect para `/auth` ou `/app` consoante sessão.
- Botão "Terminar sessão" + seletor de idioma no topo.

### 5. i18n (react-i18next)

- `bun add react-i18next i18next i18next-browser-languagedetector`
- `src/i18n/index.ts` configura PT-PT como default + EN como fallback.
- `src/i18n/locales/pt.json` e `en.json` com todas as strings desta fase: títulos, labels do form de login, mensagens de erro, papéis ("Gestor"/"Funcionário"), botão de logout, etc.
- Seletor de idioma (PT/EN) no header, persiste em localStorage.

### 6. Design

Tema claro e sóbrio (fábrica/loja de móveis) — neutros quentes, tipografia limpa, sem gradientes a roxo. Tokens definidos em `src/styles.css` (sem cores hardcoded nos componentes).

### Pergunta antes de avançar

Queres que inclua já um botão **"Criar conta"** simples no ecrã de login (para te permitires registar sem ir ao painel da Cloud), ou prefere que as contas sejam criadas exclusivamente em **Cloud → Users** + associação manual via SQL? Para um setup limpo de produção, a segunda opção é mais correta; para desenvolvimento rápido, a primeira é mais prática.

### No fim entrego

- Lista de tabelas criadas + confirmação de que RLS está ativo em todas.
- Instruções de como criar o teu primeiro utilizador gestor e associá-lo a um funcionário.
