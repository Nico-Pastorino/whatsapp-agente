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
    <div className="liquid-scroll">
      <div
        className="liquid-container liquid-enter"
        style={{
          maxWidth,
          paddingBottom: bottomPadding,
        }}
      >
        {children}
      </div>
    </div>
  );
}
