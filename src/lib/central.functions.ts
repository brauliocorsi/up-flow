import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assinaturaValida, validarFicheiros, validarSubmissao, FASES } from "./central-regras";

const acoes = [
  "criar",
  "responder",
  "comentar",
  "envolvidos",
  "atribuir",
  "apurar",
  "estado",
] as const;
export const submeterCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: FormData) => {
    if (!(v instanceof FormData)) throw new Error("Submissão inválida.");
    const acao = z.enum(acoes).parse(v.get("acao"));
    const fase = z.enum(FASES).parse(v.get("fase"));
    const dados = validarSubmissao(acao, JSON.parse(String(v.get("dados"))));
    const files = v.getAll("ficheiros").filter((f): f is File => f instanceof File);
    if (v.getAll("ficheiros").length !== files.length) throw new Error("Anexo inválido.");
    validarFicheiros(files);
    return { acao, fase, dados, files };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me, error: meError } = await supabase
      .from("funcionarios")
      .select("id,ativo")
      .eq("user_id", userId)
      .single();
    if (meError || !me?.ativo) throw new Error("Sem colaborador ativo associado.");
    if (data.dados.id) {
      const { data: canSee, error } = await supabase.rpc("central_ver", { p_id: data.dados.id });
      if (error || !canSee) throw new Error("Sem acesso ao reporte.");
    }
    // Privilege is used only for validated file staging; all business writes run as the caller.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const staged: string[] = [];
    try {
      for (const file of data.files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!assinaturaValida(file.type, bytes))
          throw new Error("O conteúdo do ficheiro não corresponde ao tipo declarado.");
        const id = crypto.randomUUID();
        const ext = (
          {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "application/pdf": "pdf",
          } as Record<string, string>
        )[file.type];
        const path = `${userId}/${id}.${ext}`;
        const safeName =
          file.name.replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 150) || `anexo.${ext}`;
        const { error: metaError } = await supabaseAdmin
          .from("reporte_ficheiros")
          .insert({
            id,
            uploader_id: me.id,
            caminho: path,
            nome: safeName,
            mime: file.type,
            tamanho: file.size,
            fase: data.fase,
          });
        if (metaError) throw new Error("Não foi possível preparar o anexo.");
        staged.push(id);
        const { error: uploadError } = await supabaseAdmin.storage
          .from("central-reportes")
          .upload(path, bytes, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error("Não foi possível guardar o ficheiro privado.");
      }
      const { data: result, error } = await supabase.rpc("central_submeter", {
        p_acao: data.acao,
        p_dados: data.dados,
        p_ficheiros: staged,
      });
      if (error) throw new Error(error.message);
      return z.object({ id: z.string().uuid(), numero: z.string().nullable() }).parse(result);
    } catch (e) {
      // Retain tracked failed uploads for reconciliation, never silently delete evidence.
      if (staged.length)
        await supabaseAdmin
          .from("reporte_ficheiros")
          .update({ estado: "falhou" })
          .in("id", staged)
          .eq("estado", "pendente");
      throw e;
    }
  });

export const abrirFicheiroCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: file, error } = await context.supabase
      .from("reporte_ficheiros")
      .select("caminho,nome,mime")
      .eq("id", data.id)
      .single();
    if (error || !file) throw new Error("Sem permissão para este anexo.");
    const { data: signed, error: signError } = await context.supabase.storage
      .from("central-reportes")
      .createSignedUrl(file.caminho, 300);
    if (signError || !signed) throw new Error("Não foi possível abrir o anexo.");
    return { url: signed.signedUrl, nome: file.nome, mime: file.mime };
  });
