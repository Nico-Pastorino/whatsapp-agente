import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y Condiciones — Atendé",
  description: "Términos y condiciones de uso de Atendé.",
};

const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 28 }}>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>{title}</h2>
    <div style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--ink-2)" }}>{children}</div>
  </section>
);

export default function TerminosPage() {
  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh", padding: "48px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--green-soft)", textDecoration: "none" }}>← Volver al inicio</Link>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: "16px 0 6px", color: "var(--ink)" }}>
          Términos y Condiciones
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 32px" }}>
          Última actualización: junio 2026. Estos textos son una base inicial y deben ser revisados
          legalmente antes de escalar comercialmente.
        </p>

        <S title="1. Qué es Atendé">
          Atendé es una herramienta para automatizar la atención de tu negocio por WhatsApp usando
          inteligencia artificial. Permite responder consultas, tomar solicitudes de reservas o turnos,
          organizar conversaciones y trabajar en equipo, siempre con la posibilidad de que una persona
          tome el control de cualquier conversación.
        </S>

        <S title="2. Conexión con WhatsApp">
          Para usar Atendé, conectás el WhatsApp de tu negocio escaneando un código QR, igual que en
          WhatsApp Web. El servicio automatiza respuestas sobre el número que conectás. Atendé no es un
          producto oficial de WhatsApp ni está afiliado a Meta. Sos responsable de usar el servicio
          respetando las condiciones de uso de WhatsApp y las buenas prácticas de mensajería: no enviar
          spam, no contactar personas que no te escribieron y responder de forma honesta. El uso indebido
          puede derivar en restricciones sobre tu número por parte de WhatsApp, algo que está fuera de
          nuestro control.
        </S>

        <S title="3. Tu información y tus respuestas">
          El asistente responde usando la información que vos cargás: datos del negocio, productos,
          servicios, precios, horarios y preguntas frecuentes. Sos responsable de que esa información sea
          correcta y esté actualizada. La inteligencia artificial puede cometer errores: te recomendamos
          supervisar las conversaciones, especialmente al principio, y usar el modo humano cuando un tema
          requiera criterio del negocio.
        </S>

        <S title="4. Prueba gratuita, planes y pagos">
          Ofrecemos una prueba gratuita de 14 días con las funciones del plan Growth, sin necesidad de
          tarjeta. Al finalizar la prueba, para seguir usando el servicio tenés que contratar un plan
          (Starter, Growth o Pro). Los pagos se procesan a través de Mercado Pago. Si el pago no se
          concreta o la suscripción se interrumpe, el servicio se pausa: tu asistente deja de responder,
          pero tus datos quedan guardados.
        </S>

        <S title="5. Cancelación">
          Podés cancelar tu plan cuando quieras desde la sección Mi Plan. La cancelación aplica al final
          del período ya pagado y no genera reintegros proporcionales. Podés reactivar tu plan más
          adelante; tu configuración y conversaciones se conservan.
        </S>

        <S title="6. Disponibilidad del servicio">
          Trabajamos para que Atendé esté disponible de forma continua, pero el servicio depende de
          proveedores externos (WhatsApp, infraestructura de hosting y base de datos, Mercado Pago y
          proveedores de inteligencia artificial). No podemos garantizar disponibilidad absoluta ni la
          ausencia total de interrupciones. Ante un problema, vamos a trabajar para restablecer el
          servicio lo antes posible.
        </S>

        <S title="7. Uso aceptable">
          No está permitido usar Atendé para actividades ilegales, envío masivo de mensajes no
          solicitados, suplantación de identidad, ni para cargar contenido que infrinja derechos de
          terceros. Podemos suspender cuentas que hagan un uso abusivo del servicio.
        </S>

        <S title="8. Contacto">
          Por cualquier consulta sobre estos términos, escribinos desde la sección Soporte de la app.
        </S>

        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
          Ver también nuestra <Link href="/privacidad" style={{ color: "var(--green-soft)" }}>Política de Privacidad</Link>.
        </p>
      </div>
    </main>
  );
}
