import type { ReactNode } from "react";

export default function DashboardContentShell({
  children,
  maxWidth = 1120,
  bottomPadding = 100,
}: {
  children: ReactNode;
  maxWidth?: number;
  bottomPadding?: number;
}) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg)" }}>
      <div
        style={{
          width: "100%",
          maxWidth,
          margin: "0 auto",
          padding: `0 0 ${bottomPadding}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
