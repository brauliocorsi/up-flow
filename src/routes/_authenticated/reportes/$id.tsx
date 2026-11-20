import { createFileRoute } from "@tanstack/react-router";
import { DetalheCentral } from "@/components/qualidade/DetalheCentral";
export const Route = createFileRoute("/_authenticated/reportes/$id")({
  component: ReportePage,
  head: () => ({
    meta: [
      { title: "Tratamento de reporte · UP Flow" },
      {
        name: "description",
        content: "Participação, apuração, correção e validação auditadas do reporte.",
      },
      { property: "og:title", content: "Tratamento de reporte · UP Flow" },
      {
        property: "og:description",
        content: "Histórico e evidência de participação, correção e validação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
function ReportePage() {
  const { id } = Route.useParams();
  return <DetalheCentral id={id} />;
}
