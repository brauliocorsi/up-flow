import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/routes/_authenticated/route";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, GripVertical, Pencil, Plus } from "lucide-react";
import { CADENCIAS, normalizeCadencia, type Cadencia } from "@/lib/cadencia";

export const Route = createFileRoute("/_authenticated/construtor/")({
  component: ConstrutorPage,
});

type Funcionario = { id: string; nome: string; cor: string | null; ativo: boolean };
type Atividade = {
  id: string;
  funcao_id: string;
  nome: string;
  descricao: string | null;
  duracao_padrao_min: number;
  cor: string | null;
  cadencia: Cadencia;
};
type Setor = { id: string; nome: string };
type Horario = { tipo_dia: string; hora_inicio: string; hora_fim: string };
type Pausa = {
  id: string;
  tipo_dia: string;
  nome: string;
  hora_inicio: string;
  hora_fim: string;
};
type Bloco = {
  id: string;
  funcionario_id: string;
  dia_semana: number;
  atividade_id: string;
  hora_inicio: string;
  hora_fim: string;
  ordem: number;
  cadencia: Cadencia;
  grupo_id: string | null;
};

const PX_PER_MIN = 1.2;
const SLOT_MIN = 15;

function hmToMin(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function minToHm(min: number) {
  const m = Math.max(0, Math.round(min));
  const hh = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
function tipoDiaFromDow(dow: number): "util" | "sabado" {
  return dow === 6 ? "sabado" : "util";
}

function ConstrutorPage() {
  const { t } = useTranslation();
  const user = useAuthUser();
  const qc = useQueryClient();
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [dia, setDia] = useState<number>(1);
  const [editing, setEditing] = useState<Bloco | null>(null);
  const [copying, setCopying] = useState(false);
  const [addingFromActivity, setAddingFromActivity] = useState<Atividade | null>(null);

  const { data: isGestor, isLoading: loadingRole } = useQuery({
    queryKey: ["is-gestor", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "gestor")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const funcionariosQ = useQuery({
    enabled: !!isGestor,
    queryKey: ["construtor-funcionarios"],
    queryFn: async (): Promise<Funcionario[]> => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cor, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Funcionario[];
    },
  });

  const tipoDia = tipoDiaFromDow(dia);

  const setoresQ = useQuery({
    enabled: !!funcionarioId,
    queryKey: ["construtor-setores", funcionarioId],
    queryFn: async (): Promise<Setor[]> => {
      const { data, error } = await supabase
        .from("funcionario_setores")
        .select("funcao_id, funcoes(id, nome)")
        .eq("funcionario_id", funcionarioId);
      if (error) throw error;
      const out: Setor[] = [];
      for (const r of data ?? []) {
        const f = (r as { funcoes: { id: string; nome: string } | null }).funcoes;
        if (f) out.push({ id: f.id, nome: f.nome });
      }
      return out;
    },
  });

  const setorIds = useMemo(() => (setoresQ.data ?? []).map((s) => s.id), [setoresQ.data]);

  const atividadesQ = useQuery({
    enabled: setorIds.length > 0,
    queryKey: ["construtor-atividades", setorIds.join(",")],
    queryFn: async (): Promise<Atividade[]> => {
      const { data, error } = await supabase
        .from("atividades")
        .select("id, funcao_id, nome, descricao, duracao_padrao_min, cor, cadencia")
        .in("funcao_id", setorIds)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((a) => ({ ...a, cadencia: normalizeCadencia((a as { cadencia?: string }).cadencia) })) as Atividade[];
    },
  });

  const horarioQ = useQuery({
    enabled: !!funcionarioId,
    queryKey: ["construtor-horario", funcionarioId, tipoDia],
    queryFn: async (): Promise<Horario | null> => {
      const { data, error } = await supabase
        .from("horarios_trabalho")
        .select("tipo_dia, hora_inicio, hora_fim")
        .eq("funcionario_id", funcionarioId)
        .eq("tipo_dia", tipoDia)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Horario | null;
    },
  });

  const pausasQ = useQuery({
    enabled: !!funcionarioId,
    queryKey: ["construtor-pausas", funcionarioId, tipoDia],
    queryFn: async (): Promise<Pausa[]> => {
      const { data, error } = await supabase
        .from("pausas_fixas")
        .select("id, tipo_dia, nome, hora_inicio, hora_fim")
        .eq("funcionario_id", funcionarioId)
        .eq("tipo_dia", tipoDia)
        .eq("ativo", true)
        .order("hora_inicio");
      if (error) throw error;
      return (data ?? []) as Pausa[];
    },
  });

  const blocosQ = useQuery({
    enabled: !!funcionarioId,
    queryKey: ["construtor-blocos", funcionarioId, dia],
    queryFn: async (): Promise<Bloco[]> => {
      const { data, error } = await supabase
        .from("rotina_blocos")
        .select("id, funcionario_id, dia_semana, atividade_id, hora_inicio, hora_fim, ordem, cadencia, grupo_id")
        .eq("funcionario_id", funcionarioId)
        .eq("dia_semana", dia)
        .order("hora_inicio");
      if (error) throw error;
      return (data ?? []).map((b) => ({
        ...b,
        cadencia: normalizeCadencia((b as { cadencia?: string }).cadencia),
      })) as Bloco[];
    },
  });

  const atividadeById = useMemo(() => {
    const m = new Map<string, Atividade>();
    for (const a of atividadesQ.data ?? []) m.set(a.id, a);
    return m;
  }, [atividadesQ.data]);

  const horario = horarioQ.data;
  const pausas = pausasQ.data ?? [];
  const blocos = blocosQ.data ?? [];

  function checkConflict(startMin: number, endMin: number, ignoreBlockId?: string): string | null {
    if (endMin <= startMin) return t("construtor.ordemInvalida");
    if (!horario) return t("construtor.semHorario");
    const dayStart = hmToMin(horario.hora_inicio);
    const dayEnd = hmToMin(horario.hora_fim);
    if (startMin < dayStart || endMin > dayEnd) return t("construtor.foraHorario");
    for (const p of pausas) {
      const ps = hmToMin(p.hora_inicio);
      const pe = hmToMin(p.hora_fim);
      if (startMin < pe && endMin > ps) return t("construtor.sobrepoePausa");
    }
    for (const b of blocos) {
      if (ignoreBlockId && b.id === ignoreBlockId) continue;
      const bs = hmToMin(b.hora_inicio);
      const be = hmToMin(b.hora_fim);
      if (startMin < be && endMin > bs) return t("construtor.sobrepoeBloco");
    }
    return null;
  }

  const createBloco = useMutation({
    mutationFn: async (payload: { atividade_id: string; startMin: number; endMin: number; cadencia?: Cadencia }) => {
      const cad = normalizeCadencia(payload.cadencia);
      const hi = minToHm(payload.startMin);
      const hf = minToHm(payload.endMin);

      if (cad === "diaria") {
        const conflict = checkConflict(payload.startMin, payload.endMin);
        if (conflict) throw new Error(t("construtor.diariaConflito", { erro: conflict }));
        const grupoId = (crypto as Crypto).randomUUID();
        const rows: Array<{
          funcionario_id: string;
          dia_semana: number;
          atividade_id: string;
          hora_inicio: string;
          hora_fim: string;
          ordem: number;
          cadencia: Cadencia;
          grupo_id: string;
        }> = [];
        for (let d = 1; d <= 5; d++) {
          rows.push({
            funcionario_id: funcionarioId,
            dia_semana: d,
            atividade_id: payload.atividade_id,
            hora_inicio: hi,
            hora_fim: hf,
            ordem: 0,
            cadencia: "diaria",
            grupo_id: grupoId,
          });
        }
        const { error } = await supabase.from("rotina_blocos").insert(rows);
        if (error) throw error;
        return { diaria: true };
      }

      const conflict = checkConflict(payload.startMin, payload.endMin);
      if (conflict) throw new Error(conflict);
      const { error } = await supabase.from("rotina_blocos").insert({
        funcionario_id: funcionarioId,
        dia_semana: dia,
        atividade_id: payload.atividade_id,
        hora_inicio: hi,
        hora_fim: hf,
        ordem: blocos.length,
        cadencia: cad,
      });
      if (error) throw error;
      return { diaria: false };
    },
    onSuccess: (r) => {
      toast.success(r?.diaria ? t("construtor.diariaCriada") : t("construtor.guardado"));
      qc.invalidateQueries({ queryKey: ["construtor-blocos", funcionarioId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBloco = useMutation({
    mutationFn: async (payload: { id: string; startMin: number; endMin: number; atividade_id?: string; cadencia?: Cadencia }) => {
      const conflict = checkConflict(payload.startMin, payload.endMin, payload.id);
      if (conflict) throw new Error(conflict);
      const upd: {
        hora_inicio: string;
        hora_fim: string;
        atividade_id?: string;
        cadencia?: Cadencia;
      } = {
        hora_inicio: minToHm(payload.startMin),
        hora_fim: minToHm(payload.endMin),
      };
      if (payload.atividade_id) upd.atividade_id = payload.atividade_id;
      if (payload.cadencia) upd.cadencia = payload.cadencia;

      const target = blocos.find((b) => b.id === payload.id);
      if (target?.grupo_id && target.cadencia === "diaria" && (payload.cadencia ?? "diaria") === "diaria") {
        // Propagar a todo o grupo (seg-sex)
        const { error } = await supabase
          .from("rotina_blocos")
          .update(upd)
          .eq("grupo_id", target.grupo_id);
        if (error) throw error;
        return;
      }
      // Se mudou cadencia para fora de 'diaria', desliga do grupo
      if (target?.grupo_id && payload.cadencia && payload.cadencia !== "diaria") {
        (upd as Record<string, unknown>).grupo_id = null;
      }
      const { error } = await supabase.from("rotina_blocos").update(upd).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("construtor.guardado"));
      qc.invalidateQueries({ queryKey: ["construtor-blocos", funcionarioId] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBloco = useMutation({
    mutationFn: async (id: string) => {
      const target = blocos.find((b) => b.id === id);
      if (target?.grupo_id) {
        const { error } = await supabase.from("rotina_blocos").delete().eq("grupo_id", target.grupo_id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("rotina_blocos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("construtor.removido"));
      qc.invalidateQueries({ queryKey: ["construtor-blocos", funcionarioId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("slot:")) return;
    const slotMin = parseInt(overId.slice(5), 10);
    const activeId = String(active.id);
    if (activeId.startsWith("lib:")) {
      const ativId = activeId.slice(4);
      const a = atividadeById.get(ativId);
      if (!a) return;
      const dur = Math.max(SLOT_MIN, a.duracao_padrao_min || 30);
      createBloco.mutate({ atividade_id: ativId, startMin: slotMin, endMin: slotMin + dur, cadencia: a.cadencia });
    } else if (activeId.startsWith("bloco:")) {
      const bid = activeId.slice(6);
      const b = blocos.find((x) => x.id === bid);
      if (!b) return;
      const dur = hmToMin(b.hora_fim) - hmToMin(b.hora_inicio);
      updateBloco.mutate({ id: bid, startMin: slotMin, endMin: slotMin + dur });
    }
  }

  if (loadingRole) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!isGestor) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("construtor.apenasGestor")}{" "}
        <Link to="/hoje" className="underline">
          {t("nav.hoje")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-foreground">{t("construtor.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("construtor.subtitle")}</p>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("construtor.escolheFuncionario")}</span>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={funcionarioId}
            onChange={(e) => setFuncionarioId(e.target.value)}
          >
            <option value="">—</option>
            {(funcionariosQ.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("construtor.escolheDia")}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDia(d)}
                className={`rounded-md border px-3 py-2 text-sm ${
                  dia === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {t(`construtor.diasCurtos.${d}`)}
              </button>
            ))}
          </div>
        </label>

        <div className="ml-auto">
          <Button
            variant="outline"
            disabled={!funcionarioId || blocos.length === 0}
            onClick={() => setCopying(true)}
          >
            {t("construtor.copiarBtn")}
          </Button>
        </div>
      </div>

      {!funcionarioId ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("construtor.escolheFuncionario")}
        </p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <Library
              atividades={atividadesQ.data ?? []}
              onClickAdd={(a) => setAddingFromActivity(a)}
              loading={atividadesQ.isLoading}
            />
            <Grid
              horario={horario ?? null}
              pausas={pausas}
              blocos={blocos}
              atividadeById={atividadeById}
              onEdit={(b) => setEditing(b)}
              onDelete={(id) => deleteBloco.mutate(id)}
              onAdjust={(b, deltaMinEnd) => {
                const startMin = hmToMin(b.hora_inicio);
                const endMin = hmToMin(b.hora_fim) + deltaMinEnd;
                updateBloco.mutate({ id: b.id, startMin, endMin });
              }}
            />
          </div>
        </DndContext>
      )}

      {addingFromActivity && horario && (
        <AddDialog
          atividade={addingFromActivity}
          horario={horario}
          onClose={() => setAddingFromActivity(null)}
          onConfirm={(startMin, endMin, cadencia) => {
            createBloco.mutate(
              { atividade_id: addingFromActivity.id, startMin, endMin, cadencia },
              { onSuccess: () => setAddingFromActivity(null) },
            );
          }}
        />
      )}

      {editing && horario && (
        <EditDialog
          bloco={editing}
          atividade={atividadeById.get(editing.atividade_id) ?? null}
          horario={horario}
          onClose={() => setEditing(null)}
          onSave={(startMin, endMin, cadencia) =>
            updateBloco.mutate({ id: editing.id, startMin, endMin, cadencia })
          }
        />
      )}

      {copying && (
        <CopyDialog
          diaOrigem={dia}
          funcionarioId={funcionarioId}
          onClose={() => setCopying(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["construtor-blocos", funcionarioId] });
            setCopying(false);
          }}
        />
      )}
    </div>
  );
}

// ---------- Library ----------
function Library({
  atividades,
  onClickAdd,
  loading,
}: {
  atividades: Atividade[];
  onClickAdd: (a: Atividade) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <aside className="rounded-lg border border-border bg-card p-3">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{t("construtor.biblioteca")}</h2>
      {loading ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : atividades.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("construtor.semAtividades")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {atividades.map((a) => (
            <LibraryItem key={a.id} atividade={a} onClickAdd={() => onClickAdd(a)} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function LibraryItem({ atividade, onClickAdd }: { atividade: Atividade; onClickAdd: () => void }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lib:${atividade.id}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-background p-2"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="drag"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: atividade.cor ?? "#94a3b8" }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{atividade.nome}</span>
          <MiniCadenciaBadge cadencia={atividade.cadencia} />
        </div>
        {atividade.descricao && (
          <div className="line-clamp-2 text-[11px] text-muted-foreground">{atividade.descricao}</div>
        )}
        <div className="text-[11px] text-muted-foreground">
          {t("construtor.minutos", { m: atividade.duracao_padrao_min })}
        </div>
      </div>
      <button
        type="button"
        onClick={onClickAdd}
        className="rounded-md border border-input p-1 text-muted-foreground hover:bg-accent"
        aria-label="add"
      >
        <Plus className="h-4 w-4" />
      </button>
    </li>
  );
}

// ---------- Grid ----------
function Grid({
  horario,
  pausas,
  blocos,
  atividadeById,
  onEdit,
  onDelete,
  onAdjust,
}: {
  horario: Horario | null;
  pausas: Pausa[];
  blocos: Bloco[];
  atividadeById: Map<string, Atividade>;
  onEdit: (b: Bloco) => void;
  onDelete: (id: string) => void;
  onAdjust: (b: Bloco, deltaMinEnd: number) => void;
}) {
  const { t } = useTranslation();
  if (!horario) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        <p>{t("construtor.semHorario")}</p>
        <p className="mt-1 text-xs">{t("construtor.defineHorarioPrimeiro")}</p>
      </div>
    );
  }
  const startMin = hmToMin(horario.hora_inicio);
  const endMin = hmToMin(horario.hora_fim);
  const totalMin = endMin - startMin;
  const totalHeight = totalMin * PX_PER_MIN;

  // Build 15-min slots
  const slots: number[] = [];
  for (let m = startMin; m < endMin; m += SLOT_MIN) slots.push(m);

  // Hour labels
  const hourMarks: number[] = [];
  const firstHour = Math.ceil(startMin / 60) * 60;
  for (let h = firstHour; h <= endMin; h += 60) hourMarks.push(h);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {horario.hora_inicio} – {horario.hora_fim}
        </span>
        {blocos.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("construtor.semBlocos")}</span>
        ) : null}
      </div>
      <div className="flex">
        {/* Hour gutter */}
        <div className="w-14 flex-shrink-0" style={{ height: totalHeight, position: "relative" }}>
          {hourMarks.map((m) => (
            <div
              key={m}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground"
              style={{ top: (m - startMin) * PX_PER_MIN }}
            >
              {minToHm(m)}
            </div>
          ))}
        </div>

        {/* Grid surface */}
        <div className="relative flex-1 rounded-md border border-border" style={{ height: totalHeight }}>
          {/* Hour line backgrounds */}
          {hourMarks.map((m) => (
            <div
              key={`hl-${m}`}
              className="absolute left-0 right-0 border-t border-border/60"
              style={{ top: (m - startMin) * PX_PER_MIN }}
            />
          ))}

          {/* Droppable slots layered behind */}
          {slots.map((m) => (
            <Slot key={m} slotMin={m} startMin={startMin} />
          ))}

          {/* Pausas */}
          {pausas.map((p) => {
            const ps = hmToMin(p.hora_inicio);
            const pe = hmToMin(p.hora_fim);
            return (
              <div
                key={p.id}
                className="absolute left-1 right-1 rounded-md border border-amber-400/60 bg-amber-100/70 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                style={{
                  top: (ps - startMin) * PX_PER_MIN,
                  height: (pe - ps) * PX_PER_MIN,
                }}
              >
                <div className="font-medium">
                  {t("construtor.pausa")}: {p.nome}
                </div>
                <div className="opacity-80">
                  {p.hora_inicio.slice(0, 5)} – {p.hora_fim.slice(0, 5)}
                </div>
              </div>
            );
          })}

          {/* Blocos */}
          {blocos.map((b) => (
            <BlocoView
              key={b.id}
              bloco={b}
              startMin={startMin}
              atividade={atividadeById.get(b.atividade_id) ?? null}
              onEdit={() => onEdit(b)}
              onDelete={() => onDelete(b.id)}
              onAdjust={(delta) => onAdjust(b, delta)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Slot({ slotMin, startMin }: { slotMin: number; startMin: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slotMin}` });
  return (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 ${isOver ? "bg-primary/10" : ""}`}
      style={{
        top: (slotMin - startMin) * PX_PER_MIN,
        height: SLOT_MIN * PX_PER_MIN,
      }}
    />
  );
}

function BlocoView({
  bloco,
  startMin,
  atividade,
  onEdit,
  onDelete,
  onAdjust,
}: {
  bloco: Bloco;
  startMin: number;
  atividade: Atividade | null;
  onEdit: () => void;
  onDelete: () => void;
  onAdjust: (deltaMinEnd: number) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bloco:${bloco.id}`,
  });
  const bs = hmToMin(bloco.hora_inicio);
  const be = hmToMin(bloco.hora_fim);
  const style: React.CSSProperties = {
    top: (bs - startMin) * PX_PER_MIN,
    height: Math.max(28, (be - bs) * PX_PER_MIN),
    transform: CSS.Translate.toString(transform),
    backgroundColor: atividade?.cor ?? "#3B82F6",
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="absolute left-1 right-1 rounded-md px-2 py-1 text-xs text-white shadow-sm"
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="cursor-grab opacity-80"
          aria-label="drag"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium">{atividade?.nome ?? t("construtor.atividade")}</span>
            {bloco.cadencia !== "semanal" && (
              <span className="shrink-0 rounded-full bg-white/25 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide">
                {t(`atividades.cadencia.badge.${bloco.cadencia}`)}
              </span>
            )}
          </div>
          <div className="text-[10px] opacity-90">
            {bloco.hora_inicio.slice(0, 5)} – {bloco.hora_fim.slice(0, 5)}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-0.5 hover:bg-white/20"
          aria-label={t("construtor.editarBloco")}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-0.5 hover:bg-white/20"
          aria-label={t("construtor.remover")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1 flex gap-1">
        <button
          type="button"
          onClick={() => onAdjust(-SLOT_MIN)}
          className="rounded bg-white/15 px-1 text-[10px] hover:bg-white/25"
        >
          -15
        </button>
        <button
          type="button"
          onClick={() => onAdjust(SLOT_MIN)}
          className="rounded bg-white/15 px-1 text-[10px] hover:bg-white/25"
        >
          +15
        </button>
      </div>
    </div>
  );
}

// ---------- Add Dialog ----------
function AddDialog({
  atividade,
  horario,
  onClose,
  onConfirm,
}: {
  atividade: Atividade;
  horario: Horario;
  onClose: () => void;
  onConfirm: (startMin: number, endMin: number, cadencia: Cadencia) => void;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState(horario.hora_inicio.slice(0, 5));
  const [duracao, setDuracao] = useState<number>(atividade.duracao_padrao_min || 30);
  const [cadencia, setCadencia] = useState<Cadencia>(normalizeCadencia(atividade.cadencia));
  function submit() {
    const sMin = hmToMin(start);
    onConfirm(sMin, sMin + Math.max(SLOT_MIN, duracao), cadencia);
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("construtor.adicionar")}</DialogTitle>
          <DialogDescription>{atividade.nome}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("construtor.horaInicio")}</span>
            <input
              type="time"
              step={900}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("construtor.duracao")} (min)</span>
            <input
              type="number"
              min={5}
              step={5}
              value={duracao}
              onChange={(e) => setDuracao(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-2 py-1.5"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("atividades.cadencia.label")}</span>
            <CadenciaSelect value={cadencia} onChange={setCadencia} />
            <span className="text-[11px] text-muted-foreground">{t("construtor.cadencia.help")}</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Edit Dialog ----------
function EditDialog({
  bloco,
  atividade,
  horario,
  onClose,
  onSave,
}: {
  bloco: Bloco;
  atividade: Atividade | null;
  horario: Horario;
  onClose: () => void;
  onSave: (startMin: number, endMin: number, cadencia: Cadencia) => void;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState(bloco.hora_inicio.slice(0, 5));
  const [end, setEnd] = useState(bloco.hora_fim.slice(0, 5));
  const [cadencia, setCadencia] = useState<Cadencia>(normalizeCadencia(bloco.cadencia));
  function submit() {
    onSave(hmToMin(start), hmToMin(end), cadencia);
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("construtor.editarBloco")}</DialogTitle>
          <DialogDescription>
            {atividade?.nome} · {horario.hora_inicio.slice(0, 5)}–{horario.hora_fim.slice(0, 5)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("construtor.horaInicio")}</span>
            <input
              type="time"
              step={900}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("construtor.horaFim")}</span>
            <input
              type="time"
              step={900}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("atividades.cadencia.label")}</span>
            <CadenciaSelect value={cadencia} onChange={setCadencia} />
            <span className="text-[11px] text-muted-foreground">{t("construtor.cadencia.help")}</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CadenciaSelect({ value, onChange }: { value: Cadencia; onChange: (v: Cadencia) => void }) {
  const { t } = useTranslation();
  return (
    <select
      value={value}
      onChange={(e) => onChange(normalizeCadencia(e.target.value))}
      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
    >
      {CADENCIAS.map((c) => (
        <option key={c} value={c}>{t(`atividades.cadencia.${c}`)}</option>
      ))}
    </select>
  );
}

// ---------- Copy Dialog ----------
function CopyDialog({
  diaOrigem,
  funcionarioId,
  onClose,
  onDone,
}: {
  diaOrigem: number;
  funcionarioId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number[]>([]);
  const toggle = (d: number) =>
    setSelected((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const copy = useMutation({
    mutationFn: async () => {
      if (selected.length === 0) throw new Error(t("construtor.copiarVazio"));
      const { error } = await supabase.rpc("copiar_rotina_dia", {
        _funcionario_id: funcionarioId,
        _dia_origem: diaOrigem,
        _dias_destino: selected,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("construtor.copiarSucesso"));
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("construtor.copiarTitulo")}</DialogTitle>
          <DialogDescription>{t("construtor.copiarAviso")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6]
            .filter((d) => d !== diaOrigem)
            .map((d) => (
              <label
                key={d}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  selected.includes(d)
                    ? "border-primary bg-primary/10"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(d)}
                  onChange={() => toggle(d)}
                  className="h-4 w-4"
                />
                {t(`construtor.dias.${d}`)}
              </label>
            ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => copy.mutate()} disabled={copy.isPending}>
            {copy.isPending ? t("common.saving") : t("construtor.copiarConfirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MiniCadenciaBadge({ cadencia }: { cadencia: Cadencia }) {
  const { t } = useTranslation();
  if (cadencia === "semanal") return null;
  const isMensal = cadencia.startsWith("mensal");
  const cls = isMensal
    ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${cls}`}>
      {t(`atividades.cadencia.badge.${cadencia}`)}
    </span>
  );
}
