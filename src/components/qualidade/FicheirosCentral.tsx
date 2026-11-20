import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, X, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { abrirFicheiroCentral } from "@/lib/central.functions";
import { validarFicheiros } from "@/lib/central-regras";

export function SelecionarFicheiros({
  files,
  onChange,
}: {
  files: File[];
  onChange: (v: File[]) => void;
}) {
  const [erro, setErro] = useState("");
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <Paperclip className="h-4 w-4" />
        Anexos privados
        <Input
          aria-label="Anexos privados"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => {
            const next = Array.from(e.target.files ?? []);
            try {
              validarFicheiros(next);
              onChange(next);
              setErro("");
            } catch (err) {
              setErro(err instanceof Error ? err.message : "Ficheiros inválidos");
            }
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        JPG, PNG, WebP ou PDF · 20 MB por ficheiro · até 10 ficheiros
      </p>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex min-w-0 items-center gap-2 text-xs">
          <span className="truncate">{f.name}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remover ${f.name}`}
            onClick={() => onChange(files.filter((_, n) => n !== i))}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
export function FicheirosCentral({
  reporteId,
  eventoId,
}: {
  reporteId: string;
  eventoId?: string;
}) {
  const [preview, setPreview] = useState<{ url: string; nome: string; mime: string } | null>(null);
  const [erro, setErro] = useState("");
  const q = useQuery({
    queryKey: ["reportes", "ficheiros", reporteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reporte_ficheiros")
        .select("id,nome,mime,fase,evento_id,criado_em")
        .eq("reporte_id", reporteId)
        .eq("estado", "ligado")
        .order("criado_em");
      if (error) throw error;
      return data;
    },
  });
  const files = (q.data ?? []).filter((f) =>
    eventoId ? f.evento_id === eventoId : f.fase === "abertura",
  );
  return (
    <div className="space-y-2">
      {files.map((f) => (
        <Button
          key={f.id}
          variant="outline"
          size="sm"
          className="max-w-full gap-2"
          onClick={async () => {
            try {
              setPreview(await abrirFicheiroCentral({ data: { id: f.id } }));
              setErro("");
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Sem acesso");
            }
          }}
        >
          <Eye className="h-4 w-4 shrink-0" />
          <span className="truncate">{f.nome}</span>
        </Button>
      ))}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-all">{preview?.nome}</DialogTitle>
            <DialogDescription>
              Documento privado · ligação temporária de 5 minutos
            </DialogDescription>
          </DialogHeader>
          {preview?.mime.startsWith("image/") ? (
            <img
              src={preview.url}
              alt={preview.nome}
              className="max-h-[65vh] w-full object-contain"
            />
          ) : preview ? (
            <iframe title={preview.nome} src={preview.url} className="h-[60vh] w-full border-0" />
          ) : null}
          {preview && (
            <Button asChild variant="outline">
              <a href={preview.url} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Abrir / descarregar
              </a>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
