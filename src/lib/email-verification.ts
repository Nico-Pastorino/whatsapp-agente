import "server-only";

import { getSupabaseAdminClient } from "./supabase";
import { DashboardAuthError } from "./dashboard-auth";

/**
 * Verificación de email vía Supabase Auth (campo email_confirmed_at).
 *
 * Diseño gracioso: si en el panel de Supabase la confirmación de email está
 * DESACTIVADA, los usuarios nuevos quedan confirmados al instante y este gate
 * deja pasar a todos (comportamiento idéntico al histórico). Al activar
 * "Confirm email" en Authentication → Sign In / Up, el gate empieza a aplicar.
 *
 * Usuarios existentes: fueron creados con email_confirm=true → siempre pasan.
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  return Boolean(data.user.email_confirmed_at);
}

export const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Confirmá tu correo para activar esta función. Revisá tu casilla (y el spam) o reenviá el email desde la app.";

/** Lanza 403 con mensaje claro si el usuario no confirmó su email. */
export async function requireVerifiedEmail(userId: string): Promise<void> {
  const verified = await isEmailVerified(userId);
  if (!verified) {
    throw new DashboardAuthError(EMAIL_VERIFICATION_REQUIRED_MESSAGE, 403);
  }
}
