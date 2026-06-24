## Problema

No login do Leandro (operador), vários labels da página `/hoje` aparecem como chaves técnicas (`hoje.eventos.urgente`, `painel.estado.pendente`, etc.) em vez do texto traduzido. As chaves existem no `pt.json` — o problema é o i18next ainda não estar pronto quando os componentes renderizam (e/ou faltam variantes para alguns valores dinâmicos como `prioridade`).

## O que vai ser feito

### 1. Garantir i18n pronto antes de qualquer render
- Mover a inicialização do i18next para acontecer no arranque do router (`src/router.tsx`), antes dos módulos de rota serem importados — em vez de depender do side-effect import dentro de `src/routes/__root.tsx`.
- Garantir que a init é síncrona e idempotente em SSR e no cliente, com `react: { useSuspense: true }` e um Suspense boundary no `__root.tsx` (fallback discreto "A carregar…") para impedir que componentes renderizem antes dos recursos PT estarem ligados.
- Marcar `useTranslation()` com o flag `ready` nas páginas críticas (`/hoje`, `/painel`, layout) para nunca render­izar `t()` em estado não-pronto.

### 2. Aviso em desenvolvimento para chaves em falta
- Configurar `missingKeyHandler` no i18next para escrever um `console.warn` claro sempre que uma chave não exista, e ativar `saveMissing` apenas em modo dev. Isto torna óbvio qualquer label novo que apareça como código no futuro.

### 3. Auditoria completa de labels do operador
Vou rever, no caminho do operador (login → /hoje), todos os pontos onde se usa interpolação dinâmica e confirmar que todas as variantes existem:
- `painel.estado.${estado}` — pendente, a_decorrer, pausada, saltada, concluida (badge de estado das tarefas).
- `painel.eventoTipo.${tipo}` — recebimento, levantamento, urgencia, outro.
- `questoes.tipo.${tipo}` e `questoes.estado.${estado}` — duvida/autorizacao, aberta/respondida/fechada.
- `roles.${papel}` — gestor, funcionario.
- `horario.tipoDia.${tipoDia}`.
- Badge de urgência da tarefa atual (texto "Urgente"/"URGÊNCIA") e botões "Iniciar/Retomar/Pausar/Concluir/Saltar".
- Painel de "A atender", "Sem eventos por atender", "Retomar tarefa?", "Notificações", "Ajuda do processo", "Tenho uma questão", "Nova questão".
- Dúvidas/Macros (modal e estado vazio).

Onde encontrar variantes em falta, são acrescentadas ao `pt.json` (apenas em português; sem inglês).

### 4. Validação ao vivo
- Login como Leandro via Playwright headless, navegar para `/hoje`, capturar screenshots e o conteúdo de texto dos botões/badges, confirmar que nenhum começa por `hoje.`, `painel.`, `questoes.`, etc.
- Verificar que após Ctrl+F5 (cache limpa) tudo continua correto.

## Notas técnicas

- A causa raiz mais provável é ordem de import: `src/routes/__root.tsx` faz `import "../i18n"`, mas com SSR + code-splitting do TanStack Router, módulos de rota filhos podem ser avaliados em paralelo e correr `useTranslation()` antes do side-effect do root ser concluído. Inicializar i18n a partir de `src/router.tsx` (que é o entry-point oficial do router em TanStack Start) elimina essa janela.
- `react: { useSuspense: true }` + Suspense boundary é o mecanismo oficial do `react-i18next` para garantir que componentes só renderizam depois dos recursos carregados; é seguro mesmo com recursos inline (resolve imediatamente).
- Não se mexe em lógica de dados, RPCs, RLS, nem em ficheiros auto-gerados.

## Critérios de aceitação

1. Login como Leandro → `/hoje` → nenhum botão, badge ou texto mostra uma chave técnica (`hoje.*`, `painel.*`, `questoes.*`, `roles.*`).
2. Badges de estado das tarefas mostram "Pendente / A decorrer / Pausada / Saltada / Concluída".
3. Banner de urgência mostra "URGÊNCIA" e botão "Concluir urgência".
4. Modal de "Ajuda do processo" e "Tenho uma questão" abrem com títulos em português.
5. Em dev, `console.warn` lista qualquer chave futura em falta.
6. Sistema continua apenas em PT-PT (sem inglês).