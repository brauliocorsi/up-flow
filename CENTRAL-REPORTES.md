# Central de Erros e Reportes — entrega MVP

## Onde navegar

- Menu Qualidade → Central de Erros, `/reportes/kanban`.
- Mural anterior preservado em `/reportes`.
- Detalhe e ações em `/reportes/:id`.
- Painel de qualidade → Erros apurados, `/admin/qualidade`.

## Implementado

- Kanban com os quatro estados ativos existentes; “Não procede” separado no arquivo e com justificação.
- Filtros de pesquisa, setor, executor, envolvidos, gravidade, prazo e os meus reportes.
- Formulário atual ampliado: ocorrência, deteção, setores, envolvidos opcionais sem presunção de culpa, causa alegada, prioridade, prazo, referências externas e UP Care.
- Participação individual com respostas Reconheço / Contesto / Preciso de esclarecimentos, autor/data/texto e anexos; nunca sobrescreve respostas.
- Atribuição de executor e atualização controlada de envolvidos, avisos para novas participações e restantes interessados.
- Apuração por gestor com causa, conclusão, evidência e responsáveis apurados distintos de envolvidos.
- Ação e resultado de correção, validação com evidência escrita por outro gestor, rejeição fundamentada e arquivo justificado.
- Auditoria append-only de eventos e respostas, incluindo valores anteriores/novos de apuração, correção e prazo.
- Anexos em todas as fases; JPG/PNG/WebP/PDF, 20 MB por ficheiro, até 10 por submissão, validação de tamanho/MIME e assinatura do conteúdo no servidor, nomes seguros.
- Bucket `central-reportes` privado: sem escrita direta pelo navegador, ligações de leitura de 5 minutos autorizadas, pré-visualização de imagens/PDF.
- Metadados de autor/data/fase/vínculo. Vinculação de respostas/eventos/anexos numa transação; carregamentos falhados ficam rastreados como `falhou`, nunca apagados silenciosamente.
- Notificações internas com aviso no menu e lista de avisos por ler no Kanban.
- Agregados por mês, setor e causa: apenas erros confirmados após apuração, pendentes/contestados separados e volume de tarefas da rotina como contexto; sem ranking público de pessoas.
- Sem dados de demonstração, alterações ao GestãoClick ou criação automática de tickets UP Care.

## Permissões

- Staff: reportes dos próprios setores, abertos por si, atribuídos a si ou com a sua participação ativa.
- Gestores com papel protegido e colaborador ativo: visão ampla, apuração e validação.
- Responsáveis de setor: atribuição, participantes e tratamento; executor atribuído pode corrigir.
- Respostas individuais e seus anexos: apenas o autor e gestores; decisões/auditoria pessoal não são mostradas aos restantes no histórico.
- Não foram concedidos acessos por nome. A coordenação comercial de Sueli depende da responsabilidade do setor configurada em Equipa; os acessos existentes de Ana Catarina são preservados.

## Migrações aplicadas

- `0000_central_reportes_segura.sql`: colunas adicionais, quatro tabelas, RLS, funções, auditoria, storage e notificações.
- `0001_central_reforcar_validacao_compatibilidade.sql`: guarda da abertura, acesso por papéis protegidos, auditoria de alterações e proteção de anexos antigos vinculados.
- `0002_central_grants_minimos.sql`: privilégios mínimos explícitos nas novas tabelas.
- `0003_central_privacidade_apuracao.sql`: ocultação de decisões individuais no histórico geral.
- `0004_central_colunas_privadas.sql`: leitura direta de conclusão/evidência/responsáveis apurados bloqueada a staff; anexos de apuração reservados a gestores.

Nenhuma tabela/coluna/dado anterior foi apagado. As assinaturas das funções antigas de mudança de estado, decisão e reclassificação foram mantidas, com autorização reforçada.

## Verificado

- 10 testes de regras passaram: limites, áudio desativado, assinatura de ficheiro, envolvimento opcional, erro confirmado/apurado, causa não individual e resultado mínimo.
- 11 verificações de estrutura de segurança passaram: permissões, ausência de SELECT indiscriminado, RPC anónima bloqueada, escrita de anexos restringida, resposta privada, colunas de apuração privadas e histórico imutável.
- Compilação e verificação TypeScript automáticas sem erros na última execução.
- Navegação sem sessão para a central redireciona ao login, sem erro de execução.
- Contagem de reportes manteve-se em zero; não foram criados reportes fictícios.

## Limitações / não validado

- **Fluxo autenticado e isolamento RLS entre contas ainda não verificados de ponta a ponta.** Não havia sessão autorizada; a criação de uma conta temporária exigia aprovação indisponível. Os testes de segurança acima inspecionam regras, não substituem testes com contas reais.
- Excel, vídeo e áudio desativados no MVP; sem consentimento/controles adicionais para áudio.
- Antigas ligações assinadas já emitidas podem manter validade até expirar; o novo ecrã não as reutiliza, pede outra autorização de 5 minutos. Não foi feita rotação destrutiva de ficheiros antigos.
- A privacidade das decisões é aplicada no histórico, consultas da central e leitura direta das colunas privadas; comentários gerais devem evitar dados pessoais desnecessários.
- Não foi implementada reconciliação automática de carregamentos interrompidos/falhados nem antivírus; o rastreio persistente permite reconciliação posterior sem eliminar prova.
- A taxa por atividade usa tarefas de rotina do setor, não vendas/OS nem uma taxa de defeito comercial validada.
- A validação exige outro gestor: quando só um gestor pode corrigir e validar, é preciso atribuir a correção a outra pessoa ou disponibilizar outro gestor autorizado.
- Confirmar as responsabilidades comerciais em Equipa e testar com utilizadores autorizados antes da publicação.
