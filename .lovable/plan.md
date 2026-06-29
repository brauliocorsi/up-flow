## Objetivo

No /construtor, cada bloco passa a ter cadência clara (Diária, Semanal, Quinzenal A/B, Mensal por semana do mês) e o gestor pode saltar pontualmente uma data sem apagar a recorrência.

## Mudanças

### 1. Cadência "Diária" no construtor
- Adicionar opção `diaria` ao `CadenciaSelect` (já tem semanal/quinzenal A·B/mensal 1ª–4ª·última).
- Ao gravar um bloco marcado como Diária, replicar o bloco automaticamente para **seg–sex (dias 1–5)** na mesma hora/atividade/ordem, com `cadencia='diaria'`. Sábado (dia 6) não é incluído por defeito.
- Editar/apagar um bloco Diária propaga a alteração aos 5 dias (agrupados por um `grupo_id` opcional ou por match de atividade+hora+cadência; usar `grupo_id uuid` na tabela `rotina_blocos` para fiabilidade).
- A função `cadencia_aplica('diaria', data)` devolve `true` para qualquer dia útil (ISODOW 1–5).

### 2. UI mais clara no construtor
- O seletor de cadência mostra um resumo legível ("Todos os dias úteis", "Toda a semana", "Quinzenal – Semana A", "Mensal – 1ª semana", etc.).
- Badge colorido no cartão do bloco com a cadência ativa (já existe parcialmente; uniformizar texto).
- Ao arrastar uma atividade da biblioteca, abre o diálogo já com a cadência por defeito = `semanal`.

### 3. Exceções pontuais (saltar um dia específico)

Nova tabela `rotina_bloco_excecoes`:
- `bloco_id` (FK rotina_blocos, on delete cascade)
- `data` (date)
- `motivo` (text, opcional)
- UNIQUE (bloco_id, data)
- RLS: gestor faz tudo; funcionário vê as suas.

`cadencia_aplica` / `gerar_tarefas_do_dia` passam a verificar se existe exceção para `(bloco_id, _data)` e, se sim, saltam o bloco nesse dia.

Duas formas de criar exceção (conforme escolhido):

**a) "Saltar este dia" no /painel e /hoje**
- Botão de menu por tarefa pendente: "Saltar nesta data" → cria exceção para o `bloco_id` da tarefa e remove a tarefa de `tarefas_dia` desse dia.
- Disponível ao gestor em qualquer dia; ao operador apenas no próprio dia, com confirmação.

**b) Gestão de exceções no /construtor**
- No diálogo de edição do bloco, secção "Exceções": lista de datas saltadas + date picker para adicionar/remover.
- Indicador visual no cartão do bloco quando tem exceções futuras.

### 4. Compatibilidade
- Blocos atuais ficam com `cadencia='semanal'` (já é o default).
- `copiar_rotina_dia` continua a copiar a cadência; ao copiar um bloco Diária, ignora (já está em todos os dias).
- `tarefas_dia` ganha `bloco_id uuid` (nullable) para ligar de volta ao bloco original e permitir saltar exceções a partir do painel.

## Ficheiros tocados

- Migração SQL: `rotina_bloco_excecoes` (tabela + GRANT + RLS + policies), `rotina_blocos.grupo_id`, `tarefas_dia.bloco_id`, atualizar `cadencia_aplica` (caso `diaria`) e `gerar_tarefas_do_dia` (filtrar exceções, gravar `bloco_id`).
- `src/routes/_authenticated/construtor/index.tsx`: opção Diária, replicação seg–sex, secção de exceções, edição/apagar propagados.
- `src/components/CadenciaSelect.tsx`: nova opção + labels.
- `src/routes/_authenticated/painel/index.tsx` e `hoje/index.tsx`: ação "Saltar nesta data" por tarefa.
- i18n PT em `src/i18n/locales/pt.json`: novas chaves (`cadencia.diaria`, `construtor.excecoes.*`, `tarefa.saltar_data`).

## Confirmações no fim

1. Bloco Diária criado uma vez aparece de seg a sex.
2. Marcar "Saltar nesta data" numa segunda remove só essa segunda; nas semanas seguintes a rotina mantém-se.
3. Quinzenal e Mensal continuam a funcionar como antes.
