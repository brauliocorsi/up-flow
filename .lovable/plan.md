## Objetivo

Remover totalmente a versão em inglês e garantir que todos os textos aparecem corretamente em português (sem chaves cruas tipo `hoje.eventos.aAtender`).

## O que vai mudar

### 1. Remover inglês do sistema
- Apagar `src/i18n/locales/en.json`.
- Simplificar `src/i18n/index.ts`: carregar só `pt`, sem `localStorage`, sem `supportedLngs`/`fallbackLng` de en, `lng: "pt"` fixo.
- Remover o componente `src/components/LanguageSwitcher.tsx` e todas as suas utilizações (`auth.tsx`, `trocar-password.tsx`, `AuthenticatedLayout.tsx` e qualquer outro ponto encontrado).
- Definir `<html lang="pt">` no `__root.tsx`.

### 2. Corrigir chaves cruas a aparecer no UI
Auditar todas as chamadas `t("...")` do projeto contra `pt.json` e:
- Adicionar ao `pt.json` qualquer chave em uso que esteja em falta (causa principal de ver `hoje.eventos.aAtender` no ecrã em vez do texto traduzido).
- Corrigir typos de chaves nos componentes quando o nome estiver mal escrito.
- Garantir que `returnNull: false` e `returnEmptyString: false` continuam, e que `react: { useSuspense: false }` se mantém para evitar fallback a mostrar a key.

Ficheiros que vou varrer: todos os `src/routes/**` e `src/components/**` listados na investigação (hoje, painel, equipa, atividades, construtor, gerar, ajuda, questoes, app, auth, trocar-password, AuthenticatedLayout, HorarioEditor, MacrosSection, NovaQuestaoDialog, QuestaoConversa).

### 3. Sem alterações de funcionalidade
- Sem mexer em lógica de negócio, queries, Supabase, rotas ou layout visual além da remoção do seletor de idioma.
- Formatação de datas passa a usar sempre `pt-PT`.

## Validação
- Abrir `/app`, `/hoje`, `/painel`, `/equipa`, `/construtor`, `/atividades`, `/questoes`, `/ajuda`, `/auth` e confirmar que não aparece nenhuma chave crua nem texto em inglês.
- Verificar consola sem warnings do i18next sobre missing keys.