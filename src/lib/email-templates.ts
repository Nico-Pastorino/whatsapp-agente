/**
 * Plantillas de emails transaccionales — PREPARADAS, SIN ENVÍO TODAVÍA.
 *
 * TODO(emails): elegir proveedor (Resend recomendado por simplicidad con
 * Next/Vercel) y conectar estos templates. Puntos de disparo sugeridos:
 *  - welcome: al completar signup (api/auth/signup).
 *  - trialEnding: cron diario (worker o Vercel cron) cuando faltan 3 días.
 *  - trialEnded: cuando checkAccountAccess detecta trial_expired por primera vez.
 *  - paymentApproved: en el webhook de Mercado Pago al activar la suscripción.
 *  - planCancelled: en api/plan/cancel.
 *
 * No agregar proveedor sin confirmación (regla del proyecto).
 */

export interface EmailTemplate {
  subject: string;
  body: string; // texto plano; el proveedor puede envolverlo en HTML
}

const FIRMA = "\n\n— El equipo de Atendé";

export function welcomeEmail(p: { name: string; businessName: string }): EmailTemplate {
  return {
    subject: `¡Bienvenido a Atendé, ${p.name}!`,
    body:
      `Hola ${p.name}:\n\n` +
      `Tu cuenta para ${p.businessName} ya está lista, con 14 días de prueba gratis.\n\n` +
      `Para que tu asistente empiece a responder hoy:\n` +
      `1. Entrená tu asistente (elegí tu rubro y cargá tus datos).\n` +
      `2. Cargá tus productos o servicios.\n` +
      `3. Conectá tu WhatsApp escaneando el QR.\n\n` +
      `En 5 minutos tu negocio responde solo.` +
      FIRMA,
  };
}

export function trialEndingEmail(p: { name: string; daysLeft: number }): EmailTemplate {
  return {
    subject: `Tu prueba de Atendé termina en ${p.daysLeft} días`,
    body:
      `Hola ${p.name}:\n\n` +
      `Te quedan ${p.daysLeft} días de prueba gratis. Para que tu asistente siga ` +
      `respondiendo sin cortes, activá tu plan desde la sección Mi Plan.\n\n` +
      `Si tenés dudas sobre qué plan te conviene, respondé este correo y te ayudamos.` +
      FIRMA,
  };
}

export function trialEndedEmail(p: { name: string }): EmailTemplate {
  return {
    subject: "Tu prueba de Atendé terminó — tus datos siguen guardados",
    body:
      `Hola ${p.name}:\n\n` +
      `Tu prueba gratis terminó y tu asistente quedó en pausa. Tus conversaciones, ` +
      `productos y configuración están guardados.\n\n` +
      `Elegí un plan para reactivarlo en un minuto desde Mi Plan.` +
      FIRMA,
  };
}

export function paymentApprovedEmail(p: { name: string; planName: string }): EmailTemplate {
  return {
    subject: `Pago confirmado — plan ${p.planName} activo`,
    body:
      `Hola ${p.name}:\n\n` +
      `Recibimos tu pago y tu plan ${p.planName} ya está activo. ` +
      `Tu asistente está respondiendo con normalidad.\n\n` +
      `Gracias por confiar en Atendé.` +
      FIRMA,
  };
}

export function planCancelledEmail(p: { name: string; periodEnd: string }): EmailTemplate {
  return {
    subject: "Tu plan de Atendé quedó programado para cancelarse",
    body:
      `Hola ${p.name}:\n\n` +
      `Tu plan sigue activo hasta el ${p.periodEnd}. Después de esa fecha tu asistente ` +
      `se pausa, pero tus datos quedan guardados y podés reactivar cuando quieras.\n\n` +
      `Si cancelaste por algún problema, contanos — queremos mejorarlo.` +
      FIRMA,
  };
}
