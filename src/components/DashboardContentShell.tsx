import type { ReactNode } from "react";

export default function DashboardContentShell({
  children,
  bottomPadding = 100,
}: {
  children: ReactNode;
  /** Compatibilidad con pantallas existentes; el dashboard ahora usa ancho fluido. */
  maxWidth?: number;
  bottomPadding?: number;
}) {
  return (
    <div className="liquid-scroll">
      <div
        className="liquid-container liquid-enter"
        style={{
          paddingBottom: bottomPadding,
        }}
      >
        {children}
      </div>
    </div>
  );
}
