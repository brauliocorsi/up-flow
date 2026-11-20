import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSetores, GRAVIDADES, LABEL_GRAVIDADE } from "@/lib/qualidade";
import { enviarCentral, useCentralPessoas } from "@/lib/central";
import { type DadosCentral } from "@/lib/central-regras";
import { SelecionarFicheiros } from "./FicheirosCentral";

export function CampoCentral({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
export function EscolhaCentral({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; nome: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Não indicado</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function PessoasCentral({
  value,
  onChange,
  pessoas,
  label = "Pessoas envolvidas — hipótese, sem presunção de culpa",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  pessoas: { id: string; nome: string }[];
  label?: string;
}) {
  const [pesquisa, setPesquisa] = useState("");
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <Input
        aria-label={`Pesquisar ${label}`}
        placeholder="Pesquisar pessoa"
        value={pesquisa}
        onChange={(e) => setPesquisa(e.target.value)}
      />
      <div className="max-h-40 overflow-auto space-y-2 rounded-md border border-border p-3">
        {pessoas
          .filter((p) => p.nome.toLocaleLowerCase().includes(pesquisa.toLocaleLowerCase()))
          .map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.includes(p.id)}
                onCheckedChange={(v) =>
                  onChange(v ? [...value, p.id] : value.filter((id) => id !== p.id))
                }
              />
              {p.nome}
            </label>
          ))}
      </div>
    </fieldset>
  );
}
export function NovoReporteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const setores = useSetores(true);
  const pessoas = useCentralPessoas();
  const [dados, setDados] = useState<DadosCentral>({ gravidade: "media", envolvidos: [] });
  const [files, setFiles] = useState<File[]>([]);
  const [erro, setErro] = useState("");
  const [numero, setNumero] = useState<string | null>(null);
  function field<K extends keyof DadosCentral>(k: K, v: DadosCentral[K]) {
    setDados((d) => ({ ...d, [k]: v }));
  }
  const criar = useMutation({
    mutationFn: () => enviarCentral("criar", "abertura", dados, files),
    onSuccess: (r) => {
      setNumero(r.numero ?? "Registado");
      setDados({ gravidade: "media", envolvidos: [] });
      setFiles([]);
      setErro("");
      qc.invalidateQueries({ queryKey: ["reportes"] });
    },
    onError: (e) => setErro(e.message),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!criar.isPending) {
          onOpenChange(v);
          if (!v) {
            setNumero(null);
            setErro("");
          }
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{numero ? "Reporte criado" : "Novo reporte · Central de Erros"}</DialogTitle>
          <DialogDescription>
            {numero
              ? `Reporte ${numero} registado. As pessoas indicadas recebem um aviso na aplicação.`
              : "Regista os factos conhecidos. Não é obrigatório indicar pessoas nem atribuir culpa."}
          </DialogDescription>
        </DialogHeader>
        {numero ? (
          <DialogFooter>
            <Button
              onClick={() => {
                onOpenChange(false);
                setNumero(null);
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        ) : (
          <>
            <div className="space-y-4">
              <CampoCentral label="Título">
                <Input
                  value={dados.titulo ?? ""}
                  maxLength={200}
                  onChange={(e) => field("titulo", e.target.value)}
                  placeholder="Resumo do ocorrido"
                />
              </CampoCentral>
              <CampoCentral label="Descrição">
                <Textarea
                  value={dados.descricao ?? ""}
                  maxLength={10000}
                  rows={4}
                  onChange={(e) => field("descricao", e.target.value)}
                />
              </CampoCentral>
              <div className="grid gap-4 sm:grid-cols-2">
                <EscolhaCentral
                  label="Setor onde ocorreu"
                  value={dados.setor_origem_id ?? ""}
                  onChange={(v) => field("setor_origem_id", v)}
                  options={setores.data ?? []}
                />
                <EscolhaCentral
                  label="Setor afetado / destino"
                  value={dados.setor_destino_id ?? ""}
                  onChange={(v) => field("setor_destino_id", v)}
                  options={setores.data ?? []}
                />
                <CampoCentral label="Data da ocorrência (se conhecida)">
                  <Input
                    type="datetime-local"
                    value={dados.ocorrido_em ?? ""}
                    onChange={(e) => field("ocorrido_em", e.target.value)}
                  />
                </CampoCentral>
                <CampoCentral label="Data de deteção (se conhecida)">
                  <Input
                    type="datetime-local"
                    value={dados.detetado_em ?? ""}
                    onChange={(e) => field("detetado_em", e.target.value)}
                  />
                </CampoCentral>
                <EscolhaCentral
                  label="Prioridade / gravidade"
                  value={dados.gravidade ?? "media"}
                  onChange={(v) => field("gravidade", v as DadosCentral["gravidade"])}
                  options={GRAVIDADES.map((g) => ({ id: g, nome: LABEL_GRAVIDADE[g] }))}
                />
                <CampoCentral label="Prazo de resolução (opcional)">
                  <Input
                    type="datetime-local"
                    value={dados.prazo ?? ""}
                    onChange={(e) => field("prazo", e.target.value)}
                  />
                </CampoCentral>
              </div>
              <PessoasCentral
                value={dados.envolvidos ?? []}
                onChange={(v) => field("envolvidos", v)}
                pessoas={pessoas.data ?? []}
              />
              <CampoCentral label="Causa alegada (opcional, por apurar)">
                <Textarea
                  maxLength={2000}
                  value={dados.causa_alegada ?? ""}
                  onChange={(e) => field("causa_alegada", e.target.value)}
                />
              </CampoCentral>
              <div className="grid gap-4 sm:grid-cols-2">
                <EscolhaCentral
                  label="Tipo de referência externa"
                  value={dados.referencia_tipo ?? ""}
                  onChange={(v) => field("referencia_tipo", v as DadosCentral["referencia_tipo"])}
                  options={[
                    { id: "venda", nome: "Venda" },
                    { id: "os", nome: "OS" },
                    { id: "rota", nome: "Rota" },
                    { id: "op", nome: "OP" },
                    { id: "outro", nome: "Outro" },
                  ]}
                />
                <CampoCentral label="Referência venda / OS / rota / OP">
                  <Input
                    maxLength={200}
                    value={dados.referencia_externa ?? ""}
                    onChange={(e) => field("referencia_externa", e.target.value)}
                  />
                </CampoCentral>
              </div>
              <CampoCentral label="Referência UP Care (reclamação de cliente)">
                <Input
                  maxLength={200}
                  value={dados.up_care_referencia ?? ""}
                  onChange={(e) => field("up_care_referencia", e.target.value)}
                  placeholder="Referência existente, sem criação de ticket duplicado"
                />
              </CampoCentral>
              <SelecionarFicheiros files={files} onChange={setFiles} />
              {erro && (
                <p role="alert" className="text-sm text-destructive">
                  {erro}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={criar.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button disabled={criar.isPending} onClick={() => criar.mutate()}>
                {criar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar reporte
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
