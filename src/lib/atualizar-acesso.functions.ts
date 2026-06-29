import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  funcionario_id: z.string().uuid(),
  email: z.string().trim().email().max(255).optional(),
  password: z.string().min(8).max(128).optional(),
  must_change_password: z.boolean().optional(),
});

export type AtualizarAcessoInput = z.input<typeof inputSchema>;
export type AtualizarAcessoResult = {
  user_id: string;
  email: string | null;
  email_changed: boolean;
  password_changed: boolean;
};

export const atualizarAcessoFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<AtualizarAcessoResult> => {
    if (!data.email && !data.password) {
      throw new Error("nothing_to_update");
    }

    // 1. Verify caller is manager
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "gestor")
      .maybeSingle();
    if (roleErr) throw new Error("forbidden");
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Load funcionario -> user_id
    const { data: func, error: funcErr } = await supabaseAdmin
      .from("funcionarios")
      .select("user_id")
      .eq("id", data.funcionario_id)
      .maybeSingle();
    if (funcErr) throw new Error("funcionario_lookup_failed");
    if (!func || !func.user_id) throw new Error("funcionario_sem_acesso");

    const userId = func.user_id;

    const updatePayload: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, unknown>;
    } = {};
    if (data.email) {
      updatePayload.email = data.email;
      updatePayload.email_confirm = true;
    }
    if (data.password) {
      updatePayload.password = data.password;
    }
    if (typeof data.must_change_password === "boolean") {
      updatePayload.user_metadata = { must_change_password: data.must_change_password };
    }

    const { data: updated, error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updatePayload,
    );
    if (updErr || !updated.user) {
      const msg = updErr?.message ?? "auth_update_failed";
      if (/registered|exists|duplicate/i.test(msg)) throw new Error("email_exists");
      if (/password/i.test(msg)) throw new Error("weak_password");
      throw new Error("auth_update_failed");
    }

    return {
      user_id: userId,
      email: updated.user.email ?? null,
      email_changed: !!data.email,
      password_changed: !!data.password,
    };
  });
