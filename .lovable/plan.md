## Objetivo
O papel **Gestor** passa a comportar-se como administrador total: vê e acede a todas as áreas do sistema (incluindo as do operador), não só ao seu sub-menu atual.

## Alterações

### 1. Menu lateral (`src/components/AuthenticatedLayout.tsx`)
Quando `isGestor === true`, o menu passa a listar **todos** os itens (gestor + operador), com separadores visuais:

```
— Gestão —
  Painel
  Equipa
  Atividades
  Construtor
  Questões
  Ajuda
  Gerar tarefas
— Operador —
  A minha rotina  (/hoje)
```

Operadores continuam a ver apenas o seu sub-conjunto (sem mudanças).

### 2. Acesso à rota `/hoje` para gestor
A página `/hoje` carrega tarefas via `funcionarios.user_id = auth.uid()`. Um gestor que não esteja também ligado a um registo de funcionário veria estado vazio. Para que o gestor possa **inspecionar a vista do operador**:
- Adicionar um seletor de funcionário no topo de `/hoje` visível apenas a gestores ("A ver como: <funcionário>").
- Quando o gestor selecciona um funcionário, a página passa a ler `tarefas_dia` / `eventos` / `horarios_trabalho` desse funcionário (modo leitura — sem iniciar/parar tarefas nem responder a questões em nome dele).
- Sem selecção, mostra um estado vazio amigável com instrução para escolher um funcionário.

### 3. Indicador de papel
Na topbar (perto do email no drawer) já mostramos "Gestor". Mantém-se. Adicionar um pequeno chip "Administrador" junto ao logo quando `isGestor` para reforçar o estatuto.

## Fora do âmbito
- Não mexe em RLS / RPCs (gestores já têm `has_role('gestor')` com acesso amplo nas policies existentes).
- Não cria nova rota — reutiliza `/hoje` com modo "ver como".
- Sem alterações de tradução estrutural; apenas novas chaves PT.

## Confirmação final
1. Gestor abre o menu e vê **todas** as áreas, incluindo "A minha rotina".
2. Em `/hoje`, gestor pode escolher qualquer funcionário e ver a rotina dele em modo leitura.
3. Operador continua a ver apenas o menu reduzido.
