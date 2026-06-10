import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad — Atendé",
  description: "Cómo tratamos tus datos en Atendé.",
};

const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 28 }}>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>{title}</h2>
    <div style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--ink-2)" }}>{children}</div>
  </section>
);

export default function PrivacidadPage() {
  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh", padding: "48px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--green-soft)", textDecoration: "none" }}>← Volver al inicio</Link>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: "16px 0 6px", color: "var(--ink)" }}>
          Política de Privacidad
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 32px" }}>
          Última actualización: junio 2026. Estos textos son una base inicial y deben ser revisados
          legalmente antes de escalar comercialmente.
        </p>

        <S title="1. Qué datos guardamos">
          Para que Atendé funcione, guardamos: los datos de tu cuenta (nombre, email), los datos de tu
          negocio (nombre, descripción, horarios, información que cargás para entrenar al asistente),
          tus productos y servicios, los usuarios de tu equipo que invitás, y las conversaciones de
          WhatsApp del número que conectás (mensajes recibidos y enviados, necesarios para mostrar el
          historial y para que la IA responda con contexto).
        </S>

        <S title="2. Pagos">
          Los pagos se procesan a través de Mercado Pago. No almacenamos los datos de tu tarjeta:
          Mercado Pago procesa el pago y nosotros guardamos solo el estado de tu suscripción
          (plan, fechas, estado del pago).
        </S>

        <S title="3. Dónde se almacenan los datos">
          Tus datos se almacenan en infraestructura de proveedores cloud de primer nivel. Cada negocio
          accede únicamente a su propia información: los datos de tu negocio nunca se comparten con
          otros clientes de Atendé.
        </S>

        <S title="4. Uso de inteligencia artificial">
          Para generar respuestas automáticas, el contenido de las conversaciones y la información de tu
          negocio se procesan con proveedores de inteligencia artificial. Ese procesamiento se usa
          exclusivamente para generar las respuestas de tu asistente.
        </S>

        <S title="5. Lo que NO hacemos">
          No vendemos tus datos personales ni los de tus clientes. No usamos tus conversaciones para
          fines publicitarios. No compartimos tu información con terceros, salvo los proveedores
          necesarios para operar el servicio (hosting, base de datos, pagos e inteligencia artificial).
        </S>

        <S title="6. Seguridad">
          Aplicamos medidas de seguridad razonables: acceso autenticado, separación de datos por negocio
          y cifrado en tránsito. Ningún sistema es infalible, pero trabajamos para proteger tu
          información de forma seria.
        </S>

        <S title="7. Tus derechos">
          Podés pedir la eliminación de tu cuenta y tus datos, o una copia de tu información, escribiendo
          desde la sección Soporte. Si cancelás tu plan, tus datos se conservan para que puedas
          reactivar más adelante; podés pedir su eliminación definitiva cuando quieras.
        </S>

        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
          Ver también nuestros <Link href="/terminos" style={{ color: "var(--green-soft)" }}>Términos y Condiciones</Link>.
        </p>
      </div>
    </main>
  );
}
