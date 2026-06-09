import ConnectionGate from "@/components/ConnectionGate";

// Soporte queda accesible incluso con la prueba vencida (el usuario puede
// necesitar ayuda justamente para pagar/activar su plan). No se aplica el
// gate de cuenta acá; el middleware ya exige sesión válida.
export default function SupportPage() {
  return <ConnectionGate currentView="support" />;
}
