## Objetivo

A grelha do construtor continua a repetir-se TODAS as semanas. Para atividades quinzenais ou mensais passas a escolher **em que semana** elas aparecem **por bloco** (não na biblioteca). Assim podes colocar a mesma atividade em dois espaços diferentes com semanas diferentes (ex.: "Limpeza profunda" às 3ª 09:00 Mensal-1ª e às 3ª 09:00 Mensal-3ª).

## Mudanças

### 1. Base de dados
- Adicionar coluna `cadencia text` em `rotina_blocos` (default `'semanal'`, com o mesmo CHECK dos valores já usados em `atividades`).
- Atualizar a função `gerar_tarefas_do_dia` para usar `rb.cadencia` (a do bloco) em vez de `a.cadencia`. A cadência da biblioteca passa a ser apenas o valor sugerido ao arrastar.

### 2. Construtor (`/construtor`)
- Ao arrastar uma atividade da biblioteca para um espaço, o bloco criado herda a cadência atual da atividade (pré-preenchimento) — pode depois ser alterada no bloco.
- No diálogo de edição do bloco (já existente, com horas / atividade), adicionar um seletor **Recorrência** com as mesmas opções de `CADENCIAS` (Semanal, Quinzenal A/B, Mensal 1ª–4ª, Mensal última).
- `BlocoView`: badge passa a refletir `bloco.cadencia` (não a da atividade). Semanal não mostra badge; quinzenal/mensal mostram badge colorido como hoje.
- Biblioteca lateral: mantém o badge informativo (valor por defeito da atividade) — apenas leitura.
- Type `RotinaBloco` ganha `cadencia: Cadencia`; queries e mutations (`insert`/`update`) passam a ler/escrever o campo.

### 3. i18n
- Reusar as strings existentes `atividades.cadencia.*` no diálogo do bloco; acrescentar apenas `construtor.cadencia.label` e `construtor.cadencia.help` em `pt.json`.

## Fora de âmbito
- Não muda a UI da biblioteca de atividades (continua a ter cadência por defeito).
- Não muda `/painel`, `/hoje` nem `tarefas_dia` (já lê do bloco via RPC).
- Sem "semanas específicas" arbitrárias além das opções já suportadas (A/B e 1ª–4ª/última do mês).

## Validação
1. Criar dois blocos no mesmo dia/hora-base com cadências diferentes (Mensal-1ª e Mensal-3ª) — só aparece no `/hoje` o que corresponde à data.
2. Bloco semanal continua a aparecer todas as semanas.
3. Alterar cadência de um bloco e regenerar tarefas do dia respeita o novo valor.
