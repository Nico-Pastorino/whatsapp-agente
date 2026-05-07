export default function BrandWordmark({
  size = 20,
  color = "var(--ink)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline" }}>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: size,
          fontWeight: 600,
          color,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        atendé
      </span>
      <span
        style={{
          display: "inline-block",
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: "50%",
          background: "var(--accent)",
          marginLeft: 2,
          position: "relative",
          bottom: size * 0.35,
          flexShrink: 0,
        }}
      />
    </span>
  );
}
