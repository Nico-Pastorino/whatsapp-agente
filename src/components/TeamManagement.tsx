"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardContentShell from "./DashboardContentShell";
import { ROLE_DESCRIPTIONS } from "@/lib/role-access";

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
  owner: "Dueño",
  admin: "Admin",
  agent: "Operador",
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
      <DashboardContentShell maxWidth={1180}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 260 }}>
          <div className="atd-spinner" />
        </div>
      </DashboardContentShell>
    );
  }

  if (!data) {
    return (
      <DashboardContentShell maxWidth={1180}>
        <div style={{ maxWidth: 600, margin: "0 auto", borderRadius: 18, border: "1px solid var(--danger-border)", background: "var(--danger-tint)", padding: 20, color: "var(--accent)", fontSize: 14 }}>
          {error ?? "No se pudo cargar el equipo."}
        </div>
      </DashboardContentShell>
    );
  }

  const isLimitReached =
    !data.can_invite && typeof data.limit === "number" && data.used_total >= data.limit;

  return (
    <DashboardContentShell maxWidth={1180}>
        <div className="page-header">
          <div>
            <div className="page-sub">equipo</div>
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
            margin: 0,
            padding: "10px 14px", borderRadius: 12, fontSize: 13,
            border: error ? "1px solid var(--danger-border)" : "1px solid var(--green)",
            background: error ? "var(--danger-tint)" : "var(--green-tint)",
            color: error ? "var(--accent)" : "var(--green)",
          }}>
            {error ?? success}
          </div>
        )}

        {lastInviteLink && (
          <div style={{ margin: 0, padding: 16, borderRadius: 14, border: "1px solid var(--green)", background: "var(--green-tint)" }}>
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
          <div style={{ margin: 0, padding: "14px 16px", borderRadius: 14, border: "1px solid var(--warning-border)", background: "var(--warning-tint)" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--warning-ink)", marginBottom: 10 }}>
              Alcanzaste el límite de usuarios de tu plan.
            </p>
            <Link href="/app/plan" className="atd-btn primary sm" style={{ display: "inline-flex" }}>
              Mejorar plan
            </Link>
          </div>
        )}

        <div className="team-desktop-grid" style={{ margin: "12px 0 0" }}>
        <section className="atd-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Invitar persona</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "3px 0 0" }}>
                {data.used_total} de {data.limit ?? "∞"} usuarios · {data.plan.name}
              </p>
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {typeof data.limit === "number" ? Math.max(0, data.limit - data.used_total) : "∞"} libres
            </span>
          </div>

          {canManageTeam ? (
            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="liquid-panel" style={{ padding: 12, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span className="atd-pill green">Admin</span>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.4 }}>
                    {ROLE_DESCRIPTIONS.admin}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span className="atd-pill">Operador</span>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.4 }}>
                    {ROLE_DESCRIPTIONS.agent}
                  </p>
                </div>
              </div>
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
                  <option value="admin">{ROLE_LABELS.admin}</option>
                  <option value="agent">{ROLE_LABELS.agent}</option>
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
                <p style={{ fontSize: 13, color: "var(--warning-ink)" }}>{data.invite_block_reason}</p>
              )}
            </form>
          ) : (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontSize: 13, color: "var(--ink-3)" }}>
              Tu rol actual es {ROLE_LABELS[data.current_role]}. Podés ver el equipo, pero no crear invitaciones.
            </div>
          )}
          <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
              <div
                style={{
                  width: typeof data.limit === "number" && data.limit > 0 ? `${Math.min(100, (data.used_total / data.limit) * 100)}%` : "0%",
                  height: "100%",
                  borderRadius: 999,
                  background: isLimitReached ? "var(--danger)" : "var(--green-soft)",
                }}
              />
          </div>
        </section>

        <section className="atd-card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 12px" }}>Miembros</h3>
          <div className="team-member-grid">
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
                    style={{ borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface-2)", padding: 12 }}
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
                            disabled={rowBusy || member.role === "owner"}
                            style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--danger-border)", background: "var(--danger-tint)", fontSize: 13, fontWeight: 500, color: "var(--danger)", cursor: "pointer", opacity: (rowBusy || member.role === "owner") ? 0.5 : 1 }}
                          >
                            Quitar
                          </button>
                          {roleChanged && !adminBlockedByOwnerRule && (
                            <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>
                              {ROLE_LABELS[selectedRole]}: {ROLE_DESCRIPTIONS[selectedRole]}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="atd-card wide" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 12px" }}>Invitaciones</h3>

          <div style={{ display: "grid", gap: 8 }}>
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
                    style={{ borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface-2)", padding: 12 }}
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
                          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--danger-border)", background: "var(--danger-tint)", fontSize: 12, fontWeight: 500, color: "var(--danger)", cursor: "pointer", opacity: (rowBusy || invitation.status !== "pending") ? 0.5 : 1 }}
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
        </div>
    </DashboardContentShell>
  );
}
