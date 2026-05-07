"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardContentShell from "./DashboardContentShell";

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ height: "100%", background: "var(--bg)", padding: 24 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", borderRadius: 18, border: "1px solid #f5c2bb", background: "#fff0ee", padding: 20, color: "var(--accent)", fontSize: 14 }}>
          {error ?? "No se pudo cargar el equipo."}
        </div>
      </div>
    );
  }

  const isLimitReached =
    !data.can_invite && typeof data.limit === "number" && data.used_total >= data.limit;

  return (
    <DashboardContentShell maxWidth={1180}>
        <div className="page-header">
          <div>
            <div className="page-sub">05 · {data.used_total} de {data.limit ?? "∞"} usuarios</div>
            <h1 className="page-title">Equipo</h1>
          </div>
          {canManageTeam && !isLimitReached && (
            <button
              type="button"
              onClick={() => document.getElementById("team-invite-email")?.focus()}
              className="atd-btn primary sm"
            >
              Invitar
            </button>
          )}
        </div>

        {(success || error) && (
          <div style={{
            margin: "0 20px",
            padding: "10px 14px", borderRadius: 12, fontSize: 13,
            border: error ? "1px solid #f5c2bb" : "1px solid var(--green)",
            background: error ? "#fff0ee" : "var(--green-tint)",
            color: error ? "var(--accent)" : "var(--green)",
          }}>
            {error ?? success}
          </div>
        )}

        {lastInviteLink && (
          <div style={{ margin: "0 20px", padding: 16, borderRadius: 14, border: "1px solid var(--green)", background: "var(--green-tint)" }}>
            <p style={{ fontSize: 13, color: "var(--green)", marginBottom: 10 }}>
              Invitación creada. Copiá el link y enviáselo a la persona.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={lastInviteLink}
                readOnly
                className="atd-input mono"
                style={{ fontSize: 11 }}
              />
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(lastInviteLink)
                    .then(() => setSuccess("Link copiado."))
                    .catch(() => setError("No se pudo copiar el link."))
                }
                className="atd-btn primary sm"
              >
                Copiar link
              </button>
            </div>
          </div>
        )}

        {isLimitReached && (
          <div style={{ margin: "0 20px", padding: "14px 16px", borderRadius: 14, border: "1px solid #ffe5a0", background: "#fffbeb" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#7a5800", marginBottom: 10 }}>
              Alcanzaste el límite de usuarios de tu plan.
            </p>
            <Link href="/app/plan" className="atd-btn primary sm" style={{ display: "inline-flex" }}>
              Mejorar plan
            </Link>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-3">
        <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
          <div className="page-sub" style={{ marginBottom: 4 }}>Invitar persona</div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>Crear invitación</h3>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
            Invitá a una persona por email para que se sume al equipo.
          </p>

          {canManageTeam ? (
            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                id="team-invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="usuario@negocio.com"
                disabled={inviteLoading || !data.can_invite}
                className="atd-input"
              />
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }} className="min-[430px]:grid-cols-[minmax(0,1fr)_minmax(180px,220px)_auto]">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "agent")}
                  disabled={inviteLoading || !data.can_invite}
                  className="atd-input"
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
                <button
                  type="submit"
                  disabled={inviteLoading || !data.can_invite || !inviteEmail.trim()}
                  className="atd-btn primary sm"
                >
                  {inviteLoading ? "Creando..." : "Crear"}
                </button>
              </div>
              {!data.can_invite && data.invite_block_reason && (
                <p style={{ fontSize: 13, color: "#7a5800" }}>{data.invite_block_reason}</p>
              )}
            </form>
          ) : (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontSize: 13, color: "var(--ink-3)" }}>
              Tu rol actual es {ROLE_LABELS[data.current_role]}. Podés ver el equipo, pero no crear invitaciones.
            </div>
          )}
        </section>
        <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
          <div className="page-sub" style={{ marginBottom: 4 }}>Capacidad del plan</div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>Usuarios disponibles</h3>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
            El owner cuenta como usuario y las invitaciones pendientes también reservan lugar.
          </p>
          <div style={{ borderRadius: 16, background: "var(--surface-2)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10, fontSize: 13, color: "var(--ink-2)" }}>
              <span>Usuarios: <strong style={{ color: "var(--ink)" }}>{data.used_total} / {data.limit ?? "∞"}</strong></span>
              <span>{data.plan.name}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "var(--surface)", overflow: "hidden" }}>
              <div
                style={{
                  width: typeof data.limit === "number" && data.limit > 0 ? `${Math.min(100, (data.used_total / data.limit) * 100)}%` : "0%",
                  height: "100%",
                  borderRadius: 999,
                  background: isLimitReached ? "#c0392b" : "var(--green-soft)",
                }}
              />
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 14 }} className="min-[430px]:grid-cols-3">
              <div style={{ borderRadius: 12, background: "var(--surface)", padding: 12 }}>
                <div className="page-sub" style={{ marginBottom: 4 }}>activos</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{data.used_active}</div>
              </div>
              <div style={{ borderRadius: 12, background: "var(--surface)", padding: 12 }}>
                <div className="page-sub" style={{ marginBottom: 4 }}>pendientes</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{data.used_pending}</div>
              </div>
              <div style={{ borderRadius: 12, background: "var(--surface)", padding: 12 }}>
                <div className="page-sub" style={{ marginBottom: 4 }}>disponibles</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
                  {typeof data.limit === "number" ? Math.max(0, data.limit - data.used_total) : "∞"}
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>

        <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
          <div className="page-sub" style={{ marginBottom: 4 }}>Miembros activos</div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>Equipo</h3>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
            Personas que ya pueden entrar al dashboard de este negocio.
          </p>
          <div style={{ display: "grid", gap: 10 }} className="lg:grid-cols-2">
            {data.members.length === 0 ? (
              <div style={{ padding: "28px 20px", textAlign: "center", border: "2px dashed var(--hairline)", borderRadius: 14, fontSize: 13, color: "var(--muted)" }}>
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
                    style={{ borderRadius: 14, border: "1px solid var(--hairline)", background: "var(--surface-2)", padding: 14 }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {member.full_name?.trim() || member.email}
                        </p>
                        {member.full_name?.trim() && (
                          <p style={{ marginTop: 2, fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.email}</p>
                        )}
                        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <span className="atd-pill" style={{ fontSize: 11, background: "var(--surface)" }}>
                            {ROLE_LABELS[member.role]}
                          </span>
                          <span className="atd-pill" style={{ fontSize: 11, background: "var(--surface)", color: member.status === "active" ? "var(--green)" : "var(--muted)" }}>
                            {getStatusLabel(member.status)}
                          </span>
                          <span className="atd-pill" style={{ fontSize: 11, background: "var(--surface)" }}>
                            {formatDate(member.created_at)}
                          </span>
                        </div>
                      </div>

                      {canManageTeam ? (
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }} className="min-[430px]:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <select
                            value={selectedRole}
                            onChange={(e) =>
                              setRoleDrafts((current) => ({
                                ...current,
                                [member.id]: e.target.value as BusinessMemberRole,
                              }))
                            }
                            disabled={rowBusy || adminBlockedByOwnerRule}
                            className="atd-input"
                            style={{ opacity: rowBusy || adminBlockedByOwnerRule ? 0.5 : 1 }}
                          >
                            {(["owner", "admin", "agent"] as BusinessMemberRole[])
                              .filter((role) => data.current_role === "owner" || role !== "owner")
                              .map((role) => (
                                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRoleUpdate(member.id)}
                            disabled={rowBusy || !roleChanged || adminBlockedByOwnerRule}
                            className="atd-btn secondary sm"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(member.id, member.email)}
                            disabled={rowBusy || (data.current_role === "admin" && member.role === "owner")}
                            style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #f5c2bb", background: "#fff0ee", fontSize: 13, fontWeight: 500, color: "#c0392b", cursor: "pointer", opacity: (rowBusy || (data.current_role === "admin" && member.role === "owner")) ? 0.5 : 1 }}
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

        <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
          <div className="page-sub" style={{ marginBottom: 4 }}>Invitaciones pendientes</div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>Invitaciones</h3>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
            Invitaciones creadas para sumar personas al equipo.
          </p>

          <div style={{ display: "grid", gap: 10 }} className="lg:grid-cols-2">
            {visibleInvitations.length === 0 ? (
              <div style={{ padding: "28px 20px", textAlign: "center", border: "2px dashed var(--hairline)", borderRadius: 14, fontSize: 13, color: "var(--muted)" }}>
                No hay invitaciones creadas todavía.
              </div>
            ) : (
              visibleInvitations.map((invitation) => {
                const inviteLink = `${inviteBaseUrl}${invitation.token}`;
                const rowBusy = invitationLoadingId === invitation.id;

                return (
                  <article
                    key={invitation.id}
                    style={{ borderRadius: 14, border: "1px solid var(--hairline)", background: "var(--surface-2)", padding: 14 }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {invitation.email}
                        </p>
                        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <span className="atd-pill" style={{ fontSize: 11, background: "var(--surface)" }}>{ROLE_LABELS[invitation.role]}</span>
                          <span className="atd-pill" style={{ fontSize: 11, background: "var(--surface)", color: invitation.status === "pending" ? "var(--green)" : "var(--muted)" }}>
                            {STATUS_LABELS[invitation.status]}
                          </span>
                          <span className="atd-pill" style={{ fontSize: 11, background: "var(--surface)" }}>Vence: {formatDate(invitation.expires_at)}</span>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr" }} className="min-[430px]:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <input
                          value={inviteLink}
                          readOnly
                          className="atd-input mono"
                          style={{ fontSize: 10 }}
                        />
                        <button type="button" onClick={() => copyInvitationLink(invitation)} className="atd-btn secondary sm">
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(invitation.id)}
                          disabled={rowBusy || invitation.status !== "pending"}
                          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #f5c2bb", background: "#fff0ee", fontSize: 12, fontWeight: 500, color: "#c0392b", cursor: "pointer", opacity: (rowBusy || invitation.status !== "pending") ? 0.5 : 1 }}
                        >
                          Revocar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
    </DashboardContentShell>
  );
}
