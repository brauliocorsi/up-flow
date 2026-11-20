import { createFileRoute } from "@tanstack/react-router";
import { CentralKanban } from "@/components/qualidade/CentralKanban";
export const Route = createFileRoute("/_authenticated/reportes/kanban")({
  component: CentralKanban,
  head: () => ({
    meta: [
      { title: "Central de Erros e Reportes · UP Móveis" },
      {
        name: "description",
        content:
          "Registo oficial de reportes, participações sem presunção de culpa, correção e validação.",
      },
      { property: "og:title", content: "Central de Erros e Reportes · UP Móveis" },
      {
        property: "og:description",
        content: "Kanban seguro de reportes, apuração e evidência de correção e validação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
