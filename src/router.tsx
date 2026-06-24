// IMPORTANT: importar o i18n ANTES do routeTree para garantir que está
// inicializado antes de qualquer módulo de rota chamar useTranslation().
import i18n from "./i18n";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

void i18n;

function DefaultPending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">…</p>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: DefaultPending,
    defaultPendingMs: 0,
    
  });

  return router;
};
