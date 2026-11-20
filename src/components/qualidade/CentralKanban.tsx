import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Archive, AlertTriangle, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCentralLista, useCentralPessoas } from "@/lib/central";
import {
  useMeuFuncionario,
  useSetores,
  LABEL_ESTADO,
  LABEL_GRAVIDADE,
  dataCurta,
  type EstadoReporte,
} from "@/lib/qualidade";
import { EscolhaCentral, NovoReporteDialog } from "./NovoReporteDialog";
import { NotificacoesCentral } from "./NotificacoesCentral";

export function CentralKanban() {
  const qc = useQueryClient();
  const q = useCentralLista();
  const me = useMeuFuncionario();
  const pessoas = useCentralPessoas();
  const setores = useSetores(false);
  const [novo, setNovo] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [executor, setExecutor] = useState("");
  const [setor, setSetor] = useState("");
  const [envolvido, setEnvolvido] = useState("");
  const [gravidade, setGravidade] = useState("");
  const [prazo, setPrazo] = useState("");
  const [meus, setMeus] = useState(false);
  const [arquivo, setArquivo] = useState(false);
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 60000);
    const ch = supabase
      .channel(`central-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reportes" }, () =>
        qc.invalidateQueries({ queryKey: ["reportes"] }),
      )
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [qc]);
  const rows = (q.data ?? []).filter((r) => {
    const term =
      `${r.numero} ${r.titulo} ${r.referencia_externa ?? ""} ${r.criador}`.toLocaleLowerCase();
    if (pesquisa && !term.includes(pesquisa.toLocaleLowerCase())) return false;
    if (executor && r.assumido_por !== executor) return false;
    if (setor && r.setor_destino_id !== setor && r.setor_origem_id !== setor) return false;
    if (envolvido && !r.envolvidos.some((p) => p.id === envolvido)) return false;
    if (gravidade && r.gravidade !== gravidade) return false;
    if (
      meus &&
      r.reportado_por !== me.data?.id &&
      r.assumido_por !== me.data?.id &&
      !r.envolvidos.some((p) => p.id === me.data?.id)
    )
      return false;
    if (prazo && (!r.prazo_resolucao || r.prazo_resolucao.slice(0, 10) > prazo)) return false;
    return arquivo ? r.estado === "nao_procede" : r.estado !== "nao_procede";
  });
  const cols: EstadoReporte[] = arquivo
    ? ["nao_procede"]
    : ["pendente", "a_tratar", "corrigido", "validado"];
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs text-primary">UP Móveis · Qualidade</p>
          <h1 className="font-display text-2xl font-semibold">Central de Erros e Reportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} reportes · {arquivo ? "Arquivo com justificação" : "Registo oficial"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/reportes">
              <LayoutGrid className="mr-2 h-4 w-4" />
              Mural atual
            </Link>
          </Button>
          <Button onClick={() => setNovo(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo reporte
          </Button>
        </div>
      </header>
      <NotificacoesCentral />
      <section
        aria-label="Filtros de reportes"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Pesquisar reportes"
            className="pl-9"
            placeholder="Número, título ou referência"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
          />
        </label>
        <EscolhaCentral
          label="Responsável pela resolução"
          value={executor}
          onChange={setExecutor}
          options={pessoas.data ?? []}
        />
        <EscolhaCentral
          label="Setor"
          value={setor}
          onChange={setSetor}
          options={setores.data ?? []}
        />
        <EscolhaCentral
          label="Pessoa envolvida (hipótese)"
          value={envolvido}
          onChange={setEnvolvido}
          options={pessoas.data ?? []}
        />
        <EscolhaCentral
          label="Gravidade"
          value={gravidade}
          onChange={setGravidade}
          options={[
            { id: "baixa", nome: "Baixa" },
            { id: "media", nome: "Média" },
            { id: "alta", nome: "Alta" },
          ]}
        />
        <label className="space-y-1.5 text-sm font-medium">
          Prazo até
          <Input
            aria-label="Prazo até"
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={meus} onCheckedChange={setMeus} />
          Os meus reportes
        </label>
        <Button variant={arquivo ? "default" : "outline"} onClick={() => setArquivo((v) => !v)}>
          <Archive className="mr-2 h-4 w-4" />
          {arquivo ? "Voltar ao Kanban" : "Arquivo · Não procede"}
        </Button>
      </section>
      {q.isPending ? (
        <p role="status">A carregar reportes…</p>
      ) : q.isError ? (
        <p role="alert" className="text-destructive">
          Não foi possível carregar: {q.error.message}
        </p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cols.map((estado) => (
            <section key={estado} aria-label={LABEL_ESTADO[estado]} className="min-w-0">
              <h2 className="flex justify-between border-b border-border pb-3 text-sm font-semibold">
                <span>{LABEL_ESTADO[estado]}</span>
                <span className="text-muted-foreground">
                  {rows.filter((r) => r.estado === estado).length}
                </span>
              </h2>
              <div className="mt-3 space-y-3">
                {rows
                  .filter((r) => r.estado === estado)
                  .map((r) => {
                    const deadline = r.prazo_resolucao ?? r.prazo_resposta;
                    const late =
                      agora > 0 &&
                      deadline &&
                      Date.parse(deadline) < agora &&
                      !["validado", "nao_procede"].includes(r.estado);
                    return (
                      <Link
                        key={r.id}
                        to="/reportes/$id"
                        params={{ id: r.id }}
                        className={`block min-w-0 rounded-lg border bg-card p-4 transition-colors hover:bg-accent ${late ? "border-destructive" : "border-border"}`}
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">{r.numero}</span>
                          <span
                            className={
                              r.gravidade === "alta"
                                ? "text-destructive"
                                : r.gravidade === "media"
                                  ? "text-warning-foreground"
                                  : "text-muted-foreground"
                            }
                          >
                            {LABEL_GRAVIDADE[r.gravidade as keyof typeof LABEL_GRAVIDADE]}
                          </span>
                        </div>
                        <h3 className="mt-2 break-words text-base font-semibold">{r.titulo}</h3>
                        <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                          <div>Origem: {r.origem ?? "Não indicada"}</div>
                          <div>Destino: {r.destino}</div>
                          <div>Criador: {r.criador}</div>
                          <div>Correção: {r.executor ?? "Por atribuir"}</div>
                          <div className="break-words">
                            Envolvimento (hipótese):{" "}
                            {r.envolvidos.map((p) => p.nome).join(", ") ||
                              "Desconhecido / não indicado"}
                          </div>
                          {r.referencia_externa && (
                            <div>
                              {r.referencia_tipo?.toUpperCase()}: {r.referencia_externa}
                            </div>
                          )}
                          <div className={late ? "text-destructive" : ""}>
                            Prazo: {dataCurta(deadline)}{" "}
                            {late && (
                              <span className="inline-flex gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Em atraso
                              </span>
                            )}
                          </div>
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {r.contestado_em && <span className="text-destructive">Contestado</span>}
                          <span
                            className={r.erro_confirmado ? "text-success" : "text-muted-foreground"}
                          >
                            {r.erro_confirmado ? "Erro apurado" : "Por apurar"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                {rows.filter((r) => r.estado === estado).length === 0 && (
                  <p className="border border-dashed border-border rounded-md py-8 text-center text-sm text-muted-foreground">
                    Sem reportes
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      <NovoReporteDialog open={novo} onOpenChange={setNovo} />
    </div>
  );
}
