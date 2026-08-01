# Redesign mobile-first + fila de urgências

Refazer a interface de toda a app numa lógica mobile → tablet → desktop, com modo escuro automático e botão manual, indicadores de eficiência por colaborador, e um novo sistema de urgências que o operador pode ordenar, pausar e retomar.

## 1. Base visual e modo escuro

- Tema claro/escuro completo com deteção automática do sistema e botão na barra de topo (Claro / Escuro / Automático), com a escolha guardada no dispositivo.
- Revisão dos tokens de cor para garantir contraste correto nos dois modos (estados de tarefa, cores de pessoa, urgências).
- Alvos de toque maiores (mínimo 44px) em todos os botões, campos e linhas clicáveis.
- Tipografia e espaçamento em escala: compacto no telemóvel, mais folgado em tablet/desktop.

## 2. Navegação mobile-first

- Barra de topo simplificada: título da página, notificações e menu.
- No telemóvel, barra de ações inferior com os destinos principais (Hoje, Painel, Questões, Menu); em tablet/desktop, menu lateral sempre visível.
- Cada página passa a ter um cabeçalho consistente com título, subtítulo e ações principais agrupadas.

## 3. Página do operador (/hoje) mais simples de ler

- Cartão grande "A decorrer agora" no topo: nome da atividade, cronómetro, previsto vs. real, e botões grandes (Concluir, Pausar, Saltar, Ajuda).
- Lista do dia em blocos por período (manhã / tarde), com estado por cor e barra de progresso.
- Faixa de resumo pessoal do dia: concluídas, pendentes, % de eficiência e tarefas fora do tempo.
- Pausas fixas visualmente distintas das atividades.

## 4. Fila de urgências (novo comportamento)

- Todas as urgências abertas passam a aparecer numa **fila** no topo do /hoje, ordenada por prioridade e hora.
- O operador escolhe **qual atender primeiro** (botão "Iniciar" em qualquer urgência da fila).
- Pode **pausar** a urgência em curso (com motivo opcional) e ela volta à fila como "Pausada", pronta a ser retomada mais tarde.
- Pode **retomar** qualquer urgência pausada, ou voltar às atividades normais sem fechar as urgências.
- Ao concluir a última urgência, a app pergunta se retoma a tarefa que estava pausada (comportamento atual mantido).
- O gestor vê no /painel quem está em urgência, qual e há quanto tempo.

## 5. Indicadores de desempenho

- **/painel (cartões)**: por pessoa — presente/ativo hoje (com base em execuções do dia), % de eficiência, nº de tarefas não cumpridas, e sinal de alerta quando há incumprimento ou atraso relevante.
- **/hoje**: o próprio colaborador vê a sua eficiência do dia e o que está em falta.
- **/relatorios**: coluna e destaque de incumprimento por colaborador no período escolhido, além dos indicadores atuais.

## 6. Restantes páginas

Equipa, Construtor, Atividades, Questões, Gerar e Ajuda recebem o mesmo tratamento: cabeçalhos consistentes, tabelas que passam a cartões no telemóvel, diálogos em ecrã inteiro em mobile e botões maiores.

## Detalhes técnicos

- **Base de dados** (1 migração): acrescentar aos `eventos` o estado `pausado`, os campos `iniciado_em`, `ordem_fila` e uma tabela de períodos de atendimento para contabilizar tempo real por urgência; novas RPCs `iniciar_urgencia`, `pausar_urgencia`, `retomar_urgencia` (segurança: só o próprio operador ou gestor), mantendo `fechar_evento` como está.
- **Tema**: provider de tema com `prefers-color-scheme` + classe `.dark` no `<html>`, persistência em localStorage; nenhum componente usa cores fixas — só tokens de `src/styles.css`.
- **Responsivo**: seguir o padrão grid + `min-w-0` + `shrink-0` nos cabeçalhos; tabelas com vista alternativa em cartões abaixo de `sm`.
- **Eficiência**: calculada no cliente a partir de `tarefas_dia` + `execucoes` (previsto ÷ real), sem alterar as RPCs de geração.
- **i18n**: todas as strings novas em PT-PT em `src/i18n/locales/pt.json`.
- Realtime mantém-se apenas no modo "ao vivo" do /painel e no /hoje, com cleanup ao mudar de data.

## Validação final

1. Telemóvel, tablet e desktop sem cortes nem scroll horizontal.
2. Modo escuro automático + botão a funcionar em todas as páginas.
3. Criar duas urgências, escolher a ordem, pausar uma, retomar depois e voltar às atividades.
4. Cartões do painel a mostrar ativo hoje, eficiência e incumprimentos.
