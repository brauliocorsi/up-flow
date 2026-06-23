import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  funcao_id: z.string().uuid(),
  papel: z.enum(["gestor", "funcionario"]),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  must_change_password: z.boolean().default(true),
});

export type CriarFuncionarioInput = z.input<typeof inputSchema>;
export type CriarFuncionarioResult = {
  funcionario_id: string;
  user_id: string;
  email: string;
};

export const criarFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<CriarFuncionarioResult> => {
    // 1. Verify caller is a manager (RLS-bound supabase, acts as the user)
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "gestor")
      .maybeSingle();
    if (roleErr) throw new Error("forbidden");
    if (!roleRow) {
      throw new Response("Forbidden", { status: 403 });
    }

    // 2. Load admin client only after authorization
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm funcao exists
    const { data: funcao, error: funcaoErr } = await supabaseAdmin
      .from("funcoes")
      .select("id")
      .eq("id", data.funcao_id)
      .maybeSingle();
    if (funcaoErr) throw new Error("funcao_lookup_failed");
    if (!funcao) throw new Error("funcao_not_found");

    // 3. Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { must_change_password: data.must_change_password },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "auth_create_failed";
      if (/registered|exists|duplicate/i.test(msg)) throw new Error("email_exists");
      if (/password/i.test(msg)) throw new Error("weak_password");
      throw new Error("auth_create_failed");
    }
    const newUserId = created.user.id;

    // 4 + 5. Insert funcionario and role, rollback auth user on any failure
    try {
      const { data: funcRow, error: insErr } = await supabaseAdmin
        .from("funcionarios")
        .insert({
          nome: data.nome.trim(),
          funcao_id: data.funcao_id,
          papel: data.papel,
          ativo: true,
          user_id: newUserId,
        })
        .select("id")
        .single();
      if (insErr || !funcRow) throw new Error("funcionario_insert_failed");

      const { error: roleInsErr } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: newUserId, role: data.papel },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (roleInsErr) throw new Error("role_insert_failed");

      return {
        funcionario_id: funcRow.id,
        user_id: newUserId,
        email: data.email,
      };
    } catch (err) {
      // Rollback: best-effort cleanup of the orphan auth user + funcionario row
      try {
        await supabaseAdmin.from("funcionarios").delete().eq("user_id", newUserId);
      } catch {
        /* ignore */
      }
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
      } catch {
        /* ignore */
      }
      throw err instanceof Error ? err : new Error("unknown_error");
    }
  });
