Plano para corrigir o problema de `app.name` aparecer no ecrã:

1. Corrigir a inicialização do i18n para ser síncrona antes do primeiro render
   - Remover o detector automático que pode inicializar tarde ou manter idioma inconsistente.
   - Inicializar diretamente com os recursos PT/EN e PT como idioma padrão.
   - Preservar a troca manual PT/EN pelo seletor.

2. Blindar o layout autenticado contra chaves cruas
   - Substituir `t("app.name")` e `t("app.tagline")` no cabeçalho/drawer por constantes seguras ou traduções com fallback explícito.
   - Substituir rótulos do menu por traduções com fallback explícito, para nunca renderizar `nav.*` ou `app.*`.

3. Remover restos de navegação antiga que podem aparecer no operador
   - Confirmar que não existem cabeçalhos antigos duplicados nem links para `/app` nas páginas autenticadas.
   - Ajustar redirecionamentos antigos para levarem o operador para `/hoje` e o gestor para as páginas corretas.

4. Validar no preview
   - Abrir o ecrã do operador `/hoje`.
   - Abrir o menu hambúrguer.
   - Confirmar que aparecem textos reais como `UP Móveis`, `A minha rotina`, `Ajuda`, `Terminar sessão`, e que não aparece nenhuma chave como `app.name`, `app.home`, `nav.*` ou `common.*`.