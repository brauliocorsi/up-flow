import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GRAVIDADES,
  LABEL_GRAVIDADE,
  corSetor,
  uploadAnexos,
  useMeuFuncionario,
  useMeusSetores,
  useSetores,
  type Gravidade,
} from "@/lib/qualidade";

export function NovoReporteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const setoresQ = useSetores(true);
  const meusSetoresQ = useMeusSetores();
  const meQ = useMeuFuncionario();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [setorDestino, setSetorDestino] = useState("");
  const [gravidade, setGravidade] = useState<Gravidade>("media");
  const [ficheiros, setFicheiros] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [numeroCriado, setNumeroCriado] = useState<string | null>(null);

  function limpar() {
    setTitulo("");
    setDescricao("");
    setSetorDestino("");
    setGravidade("media");
    setFicheiros([]);
    setErro(null);
  }

  const criar = useMutation({
    mutationFn: async () => {
      const me = meQ.data;
      if (!me) throw new Error("Não foi possível identificar o teu registo de colaborador.");
      if (!setorDestino) throw new Error("Escolhe o setor destino.");
      if (titulo.trim().length < 5) throw new Error("O título tem de ter pelo menos 5 caracteres.");
      if (descricao.trim().length < 15)
        throw new Error("A descrição tem de ter pelo menos 15 caracteres.");

      const anexos = ficheiros.length > 0 ? await uploadAnexos(ficheiros, "reportes") : [];
      const { data, error } = await supabase
        .from("reportes")
        .insert({
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          setor_destino_id: setorDestino,
          setor_origem_id: meusSetoresQ.data?.[0]?.id ?? null,
          reportado_por: me.id,
          gravidade,
          anexos,
        })
        .select("id, numero")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setNumeroCriado(data.numero ?? "—");
      limpar();
      qc.invalidateQueries({ queryKey: ["reportes"] });
    },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setNumeroCriado(null);
          setErro(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {numeroCriado ? (
          <>
            <DialogHeader>
              <DialogTitle>Reporte criado</DialogTitle>
              <DialogDescription>
                O reporte foi registado com o número <strong>{numeroCriado}</strong> e o setor
                destino já foi notificado.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => {
                  setNumeroCriado(null);
                  onOpenChange(false);
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reportar erro de processo</DialogTitle>
              <DialogDescription>
                Descreve o que correu mal e dirige o reporte ao setor responsável.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Resumo curto do erro"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  rows={5}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="O que aconteceu, onde e quando. Mínimo 15 caracteres."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Setor destino</Label>
                  <Select value={setorDestino} onValueChange={setSetorDestino}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolher setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(setoresQ.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: corSetor(s.cor) }}
                            />
                            {s.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Gravidade</Label>
                  <Select value={gravidade} onValueChange={(v) => setGravidade(v as Gravidade)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRAVIDADES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {LABEL_GRAVIDADE[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="anexos" className="inline-flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Anexos
                </Label>
                <Input
                  id="anexos"
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => setFicheiros(Array.from(e.target.files ?? []))}
                />
                {ficheiros.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {ficheiros.map((f) => (
                      <li
                        key={f.name}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]"
                      >
                        {f.name}
                        <button
                          type="button"
                          onClick={() => setFicheiros((prev) => prev.filter((x) => x !== f))}
                          aria-label="Remover anexo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {erro && <p className="text-sm text-destructive">{erro}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                {criar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar reporte
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
