"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type BusinessMemberRole = "owner" | "admin" | "agent";
type BusinessInvitationStatus = "pending" | "accepted" | "expired" | "revoked";

interface TeamMember {
  id: string;
  business_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: BusinessMemberRole;
  status: "active" | "unavailable";
  created_at: number | null;
}

interface TeamInvitation {
  id: string;
  business_id: string;
  email: string;
  role: "admin" | "agent";
  token: string;
  status: BusinessInvitationStatus;
  invited_by: string | null;
  accepted_by: string | null;
  expires_at: number | null;
  accepted_at: number | null;
  created_at: number | null;
  updated_at: number | null;
}

interface TeamResponse {
  current_role: BusinessMemberRole;
  plan: {
    code: string;
    name: string;
  };
  used_active: number;
  used_pending: number;
  used_total: number;
  limit: number | null;
  can_invite: boolean;
  invite_block_reason: string | null;
  members: TeamMember[];
  pending_invitations: TeamInvitation[];
}

const ROLE_LABELS: Record<BusinessMemberRole | "admin" | "agent", string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent",
};

const STATUS_LABELS: Record<BusinessInvitationStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  expired: "Vencida",
  revoked: "Revocada",
};

function formatDate(value: number | null): string {
  if (!value) return "Sin fecha";
  return new Date(value * 1000).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(status: TeamMember["status"]): string {
  return status === "active" ? "Activo" : "No disponible";
}

export default function TeamManagement() {
  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">("agent");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [memberLoadingId, setMemberLoadingId] = useState<string | null>(null);
  const [invitationLoadingId, setInvitationLoadingId] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, BusinessMemberRole>>({});
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    const res = await fetch("/api/team", { cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as TeamResponse & { error?: string };
    if (!res.ok) {
      throw new Error(payload.error ?? "No se pudo cargar el equipo.");
    }
    setData(payload);
    setRoleDrafts(
      Object.fromEntries(payload.members.map((member) => [member.id, member.role]))
    );
  }, []);

  useEffect(() => {
    loadTeam()
      .then(() => setError(null))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar el equipo.");
      })
      .finally(() => setLoading(false));
  }, [loadTeam]);

  useEffect(() => {
    if (!success && !error) return;
    const timeout = window.setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [success, error]);

  const canManageTeam = data?.current_role === "owner" || data?.current_role === "admin";
  const inviteBaseUrl =
    typeof window !== "undefined" ? `${window.location.origin}/invite/accept?token=` : "";

  const visibleInvitations = useMemo(
    () => (data?.pending_invitations ?? []).slice(0, 10),
    [data?.pending_invitations]
  );

  async function reloadWithFeedback(message?: string) {
    await loadTeam();
    if (message) setSuccess(message);
    setError(null);
  }

  async function copyInvitationLink(invitation: TeamInvitation) {
    const inviteLink = `${inviteBaseUrl}${invitation.token}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccess("Link copiado.");
    } catch {
      setError("No se pudo copiar el link.");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        invitation?: TeamInvitation;
      };
      if (!res.ok || !payload.invitation) {
        throw new Error(payload.error ?? "No se pudo crear la invitación.");
      }
      setInviteEmail("");
      setInviteRole("agent");
      setLastInviteLink(`${inviteBaseUrl}${payload.invitation.token}`);
      await reloadWithFeedback(
        payload.message ??
          "Creamos una invitación para este email. Copiá el link y enviáselo a la persona para que se sume al equipo."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la invitación.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleUpdate(memberId: string) {
    const nextRole = roleDrafts[memberId];
    if (!nextRole) return;

    setMemberLoadingId(memberId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/team/${memberId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo actualizar el rol.");
      }
      await reloadWithFeedback(payload.message ?? "Rol actualizado correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el rol.");
    } finally {
      setMemberLoadingId(null);
    }
  }

  async function handleRemove(memberId: string, email: string) {
    if (!confirm(`¿Querés quitar a ${email} del equipo?`)) return;

    setMemberLoadingId(memberId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo remover el usuario.");
      }
      await reloadWithFeedback(payload.message ?? "Usuario removido del negocio.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo remover el usuario.");
    } finally {
      setMemberLoadingId(null);
    }
  }

  async function handleRevoke(invitationId: string) {
    if (!confirm("¿Querés revocar esta invitación?")) return;

    setInvitationLoadingId(invitationId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo revocar la invitación.");
      }
      await reloadWithFeedback(payload.message ?? "Invitación revocada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar la invitación.");
    } finally {
      setInvitationLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full bg-gray-50 p-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error ?? "No se pudo cargar el equipo."}
        </div>
      </div>
    );
  }

  const isLimitReached =
    !data.can_invite && typeof data.limit === "number" && data.used_total >= data.limit;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
              Equipo
            </p>
            <h2 className="mt-1 text-3xl font-semibold text-gray-900">Equipo</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Gestioná las personas que pueden acceder al dashboard de este negocio.
            </p>
          </div>

          <div className="grid gap-3 sm:min-w-[290px]">
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Plan actual</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{data.plan.name}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Usuarios</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {data.used_total} / {data.limit ?? "Sin límite"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Activos: {data.used_active} · Pendientes: {data.used_pending}
              </p>
            </div>
          </div>
        </div>

        {(success || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? success}
          </div>
        )}

        {lastInviteLink && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              Creamos una invitación para este email. Copiá el link y enviáselo a la persona para que se sume al equipo.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={lastInviteLink}
                readOnly
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm text-gray-700"
              />
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(lastInviteLink)
                    .then(() => setSuccess("Link copiado."))
                    .catch(() => setError("No se pudo copiar el link."))
                }
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Copiar link
              </button>
            </div>
          </div>
        )}

        {isLimitReached && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-medium text-amber-900">
              Alcanzaste el límite de usuarios de tu plan.
            </p>
            <Link
              href="/app/plan"
              className="mt-3 inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Mejorar plan
            </Link>
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Crear invitación</h3>
          <p className="mt-1 text-sm text-gray-500">
            Invitá a una persona por email para que se sume al equipo sin crearla manualmente en Supabase.
          </p>

          {canManageTeam ? (
            <form onSubmit={handleInvite} className="mt-5 grid gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="usuario@negocio.com"
                disabled={inviteLoading || !data.can_invite}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "agent")}
                  disabled={inviteLoading || !data.can_invite}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
                <button
                  type="submit"
                  disabled={inviteLoading || !data.can_invite || !inviteEmail.trim()}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {inviteLoading ? "Creando..." : "Crear invitación"}
                </button>
              </div>
              {!data.can_invite && data.invite_block_reason && (
                <p className="text-sm text-amber-700">{data.invite_block_reason}</p>
              )}
            </form>
          ) : (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Tu rol actual es {ROLE_LABELS[data.current_role]}. Podés ver el equipo, pero no crear invitaciones.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Miembros activos</h3>
          <p className="mt-1 text-sm text-gray-500">
            Personas que ya pueden entrar al dashboard de este negocio.
          </p>
          <div className="mt-5 space-y-3">
            {data.members.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
                No hay miembros cargados en este negocio.
              </div>
            ) : (
              data.members.map((member) => {
                const selectedRole = roleDrafts[member.id] ?? member.role;
                const adminBlockedByOwnerRule =
                  data.current_role === "admin" &&
                  (member.role === "owner" || selectedRole === "owner");
                const roleChanged = selectedRole !== member.role;
                const rowBusy = memberLoadingId === member.id;

                return (
                  <article
                    key={member.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {member.full_name?.trim() || member.email}
                        </p>
                        {member.full_name?.trim() && (
                          <p className="mt-1 truncate text-sm text-gray-500">{member.email}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700">
                            Rol: {ROLE_LABELS[member.role]}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700">
                            Estado: {getStatusLabel(member.status)}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700">
                            Incorporado: {formatDate(member.created_at)}
                          </span>
                        </div>
                      </div>

                      {canManageTeam ? (
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,160px)_auto_auto]">
                          <select
                            value={selectedRole}
                            onChange={(e) =>
                              setRoleDrafts((current) => ({
                                ...current,
                                [member.id]: e.target.value as BusinessMemberRole,
                              }))
                            }
                            disabled={rowBusy || adminBlockedByOwnerRule}
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
                          >
                            {(["owner", "admin", "agent"] as BusinessMemberRole[])
                              .filter((role) => data.current_role === "owner" || role !== "owner")
                              .map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRoleUpdate(member.id)}
                            disabled={rowBusy || !roleChanged || adminBlockedByOwnerRule}
                            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900 disabled:opacity-50"
                          >
                            Guardar rol
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(member.id, member.email)}
                            disabled={rowBusy || (data.current_role === "admin" && member.role === "owner")}
                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            Quitar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Invitaciones</h3>
          <p className="mt-1 text-sm text-gray-500">
            Invitaciones creadas para sumar personas al equipo.
          </p>

          <div className="mt-5 space-y-3">
            {visibleInvitations.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
                No hay invitaciones creadas todavía.
              </div>
            ) : (
              visibleInvitations.map((invitation) => {
                const inviteLink = `${inviteBaseUrl}${invitation.token}`;
                const rowBusy = invitationLoadingId === invitation.id;

                return (
                  <article
                    key={invitation.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {invitation.email}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700">
                            Rol: {ROLE_LABELS[invitation.role]}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700">
                            Estado: {STATUS_LABELS[invitation.status]}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700">
                            Vence: {formatDate(invitation.expires_at)}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                        <input
                          value={inviteLink}
                          readOnly
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => copyInvitationLink(invitation)}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
                        >
                          Copiar link
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(invitation.id)}
                          disabled={rowBusy || invitation.status !== "pending"}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 disabled:opacity-50"
                        >
                          Revocar invitación
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
