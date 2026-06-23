import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

type TipoDia = "util" | "sabado";
type Horario = {
  id: string;
  funcionario_id: string;
  tipo_dia: TipoDia;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
};
type Pausa = {
  id: string;
  funcionario_id: string;
  tipo_dia: TipoDia;
  nome: string;
  hora_inicio: string;
  hora_fim: string;
  ordem: number;
  ativo: boolean;
};

function toHM(t: string): string {
  // database returns "HH:MM:SS"
  return t.slice(0, 5);
}

function timeLt(a: string, b: string): boolean {
  return a < b;
}

function withinRange(start: string, end: string, hStart: string, hEnd: string): boolean {
  return start >= hStart && end <= hEnd;
}

function overlap(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 < b2 && b1 < a2;
}

export function HorarioEditor({ funcionarioId }: { funcionarioId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const horariosQuery = useQuery({
    queryKey: ["horarios", funcionarioId],
    queryFn: async (): Promise<Horario[]> => {
      const { data, error } = await supabase
        .from("horarios_trabalho")
        .select("id, funcionario_id, tipo_dia, hora_inicio, hora_fim, ativo")
        .eq("funcionario_id", funcionarioId);
      if (error) throw error;
      return (data ?? []) as Horario[];
    },
  });

  const pausasQuery = useQuery({
    queryKey: ["pausas", funcionarioId],
    queryFn: async (): Promise<Pausa[]> => {
      const { data, error } = await supabase
        .from("pausas_fixas")
        .select("id, funcionario_id, tipo_dia, nome, hora_inicio, hora_fim, ordem, ativo")
        .eq("funcionario_id", funcionarioId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Pausa[];
    },
  });

  const horarios = horariosQuery.data ?? [];
  const pausas = pausasQuery.data ?? [];

  const getHorario = (td: TipoDia) => horarios.find((h) => h.tipo_dia === td);

  if (horariosQuery.isLoading || pausasQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">{t("horario.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("horario.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <HorarioCard
          tipoDia="util"
          horario={getHorario("util")}
          funcionarioId={funcionarioId}
          onChanged={() => qc.invalidateQueries({ queryKey: ["horarios", funcionarioId] })}
        />
        <HorarioCard
          tipoDia="sabado"
          horario={getHorario("sabado")}
          funcionarioId={funcionarioId}
          allowDisable
          onChanged={() => qc.invalidateQueries({ queryKey: ["horarios", funcionarioId] })}
        />
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">{t("horario.pausasTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("horario.pausasSubtitle")}</p>
      </div>

      <PausasSection
        tipoDia="util"
        horario={getHorario("util")}
        pausas={pausas.filter((p) => p.tipo_dia === "util")}
        funcionarioId={funcionarioId}
        onChanged={() => qc.invalidateQueries({ queryKey: ["pausas", funcionarioId] })}
      />
      <PausasSection
        tipoDia="sabado"
        horario={getHorario("sabado")}
        pausas={pausas.filter((p) => p.tipo_dia === "sabado")}
        funcionarioId={funcionarioId}
        onChanged={() => qc.invalidateQueries({ queryKey: ["pausas", funcionarioId] })}
      />
    </div>
  );
}

function HorarioCard({
  tipoDia,
  horario,
  funcionarioId,
  allowDisable,
  onChanged,
}: {
  tipoDia: TipoDia;
  horario: Horario | undefined;
  funcionarioId: string;
  allowDisable?: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [inicio, setInicio] = useState(horario ? toHM(horario.hora_inicio) : tipoDia === "util" ? "08:00" : "09:00");
  const [fim, setFim] = useState(horario ? toHM(horario.hora_fim) : tipoDia === "util" ? "17:30" : "12:00");
  const [naoTrabalha, setNaoTrabalha] = useState<boolean>(horario ? !horario.ativo : false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!naoTrabalha && !timeLt(inicio, fim)) {
        throw new Error(t("horario.errInicioFim"));
      }
      if (horario) {
        const { error } = await supabase
          .from("horarios_trabalho")
          .update({ hora_inicio: inicio, hora_fim: fim, ativo: !naoTrabalha })
          .eq("id", horario.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("horarios_trabalho")
          .insert({
            funcionario_id: funcionarioId,
            tipo_dia: tipoDia,
            hora_inicio: inicio,
            hora_fim: fim,
            ativo: !naoTrabalha,
          });
        if (error) throw error;
      }
    },
    onSuccess: onChanged,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">{t(`horario.tipoDia.${tipoDia}`)}</h4>
        {allowDisable && (
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={naoTrabalha} onChange={(e) => setNaoTrabalha(e.target.checked)} />
            {t("horario.naoTrabalha")}
          </label>
        )}
      </div>
      <div className={`mt-3 grid grid-cols-2 gap-2 ${naoTrabalha ? "opacity-50" : ""}`}>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t("horario.inicio")}</span>
          <input
            type="time"
            value={inicio}
            disabled={naoTrabalha}
            onChange={(e) => setInicio(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t("horario.fim")}</span>
          <input
            type="time"
            value={fim}
            disabled={naoTrabalha}
            onChange={(e) => setFim(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          {save.isPending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}

function PausasSection({
  tipoDia,
  horario,
  pausas,
  funcionarioId,
  onChanged,
}: {
  tipoDia: TipoDia;
  horario: Horario | undefined;
  pausas: Pausa[];
  funcionarioId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pausas_fixas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChanged,
  });

  const horarioAtivo = horario?.ativo;
  const hStart = horario ? toHM(horario.hora_inicio) : null;
  const hEnd = horario ? toHM(horario.hora_fim) : null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          {t(`horario.tipoDia.${tipoDia}`)}
          {hStart && hEnd && horarioAtivo && (
            <span className="ml-2 text-xs text-muted-foreground">{hStart}–{hEnd}</span>
          )}
        </h4>
        {horarioAtivo && hStart && hEnd && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-primary hover:underline"
          >
            + {t("horario.adicionarPausa")}
          </button>
        )}
      </div>

      {!horarioAtivo && (
        <p className="mt-2 text-xs text-muted-foreground">{t("horario.semHorario")}</p>
      )}

      <ul className="mt-2 space-y-2">
        {pausas.map((p) => (
          <PausaRow
            key={p.id}
            pausa={p}
            outras={pausas.filter((x) => x.id !== p.id)}
            hStart={hStart!}
            hEnd={hEnd!}
            onRemove={() => remove.mutate(p.id)}
            onSaved={onChanged}
          />
        ))}
        {pausas.length === 0 && horarioAtivo && (
          <li className="text-xs text-muted-foreground">{t("horario.semPausas")}</li>
        )}
      </ul>

      {adding && horarioAtivo && hStart && hEnd && (
        <PausaEditor
          funcionarioId={funcionarioId}
          tipoDia={tipoDia}
          hStart={hStart}
          hEnd={hEnd}
          outras={pausas}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function PausaRow({
  pausa,
  outras,
  hStart,
  hEnd,
  onRemove,
  onSaved,
}: {
  pausa: Pausa;
  outras: Pausa[];
  hStart: string;
  hEnd: string;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <PausaEditor
          funcionarioId={pausa.funcionario_id}
          tipoDia={pausa.tipo_dia}
          hStart={hStart}
          hEnd={hEnd}
          outras={outras}
          initial={pausa}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved();
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-sm">
      <span className="text-foreground">
        <strong>{pausa.nome}</strong>{" "}
        <span className="text-muted-foreground">
          {toHM(pausa.hora_inicio)}–{toHM(pausa.hora_fim)}
        </span>
      </span>
      <span className="space-x-2">
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
          {t("common.edit")}
        </button>
        <button type="button" onClick={onRemove} className="text-xs text-destructive hover:underline">
          {t("common.delete")}
        </button>
      </span>
    </li>
  );
}

function PausaEditor({
  funcionarioId,
  tipoDia,
  hStart,
  hEnd,
  outras,
  initial,
  onCancel,
  onSaved,
}: {
  funcionarioId: string;
  tipoDia: TipoDia;
  hStart: string;
  hEnd: string;
  outras: Pausa[];
  initial?: Pausa;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [inicio, setInicio] = useState(initial ? toHM(initial.hora_inicio) : hStart);
  const [fim, setFim] = useState(initial ? toHM(initial.hora_fim) : hStart);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      setError(null);
      setWarn(null);
      const cleanNome = nome.trim();
      if (!cleanNome) throw new Error(t("horario.errNome"));
      if (!timeLt(inicio, fim)) throw new Error(t("horario.errInicioFim"));
      if (!withinRange(inicio, fim, hStart, hEnd)) throw new Error(t("horario.errForaHorario"));
      const sobrep = outras.some((p) =>
        overlap(inicio, fim, toHM(p.hora_inicio), toHM(p.hora_fim)),
      );
      if (sobrep) setWarn(t("horario.warnSobreposicao"));

      if (initial) {
        const { error } = await supabase
          .from("pausas_fixas")
          .update({ nome: cleanNome, hora_inicio: inicio, hora_fim: fim })
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pausas_fixas").insert({
          funcionario_id: funcionarioId,
          tipo_dia: tipoDia,
          nome: cleanNome,
          hora_inicio: inicio,
          hora_fim: fim,
          ordem: outras.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="mt-2 rounded border border-border bg-muted/40 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs sm:col-span-3">
          <span className="text-muted-foreground">{t("horario.nomePausa")}</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("horario.nomePausaPh")}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t("horario.inicio")}</span>
          <input
            type="time"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t("horario.fim")}</span>
          <input
            type="time"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <p className="text-xs text-muted-foreground self-end">
          {t("horario.dentroDe", { start: hStart, end: hEnd })}
        </p>
      </div>
      {warn && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{warn}</p>}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {save.isPending ? t("common.saving") : t("common.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
