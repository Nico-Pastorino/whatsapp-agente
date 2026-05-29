"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PUBLIC_PLAN_LIST,
  ANNUAL_DISCOUNT,
  formatARS,
  priceForCycle,
  type BillingCycle,
} from "@/lib/plan-display";

export default function PricingPlans() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const annual = cycle === "annual";

  return (
    <div>
      {/* Toggle mensual / anual */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <div
          role="tablist"
          aria-label="Ciclo de facturación"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: 4,
            borderRadius: 999,
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            boxShadow: "var(--shadow-1)",
            position: "relative",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={!annual}
            onClick={() => setCycle("monthly")}
            className="lp-btn"
            style={{
              padding: "9px 18px",
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: !annual ? "var(--ink)" : "transparent",
              color: !annual ? "#fff" : "var(--ink-2)",
            }}
          >
            Mensual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={annual}
            onClick={() => setCycle("annual")}
            className="lp-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 18px",
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: annual ? "var(--ink)" : "transparent",
              color: annual ? "#fff" : "var(--ink-2)",
            }}
          >
            Anual
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--accent)",
                color: "#fff",
              }}
            >
              −{Math.round(ANNUAL_DISCOUNT * 100)}%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12, alignItems: "stretch" }}>
        {PUBLIC_PLAN_LIST.map((plan) => {
          const featured = plan.code === "growth";
          const price = priceForCycle(plan, cycle);

          return (
            <div
              key={plan.code}
              className={`lp-card ${featured ? "on-dark" : ""}`}
              style={{
                borderRadius: 22,
                padding: "28px 28px 24px",
                background: featured ? "var(--ink)" : "var(--surface)",
                border: featured ? "1px solid transparent" : "1px solid var(--hairline)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                transform: featured ? "scale(1.02)" : undefined,
              }}
            >
              {plan.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: -13,
                    right: 22,
                    padding: "4px 14px",
                    borderRadius: 99,
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {plan.badge}
                </div>
              )}
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: featured ? "var(--accent)" : "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginBottom: 10,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {plan.description}
              </p>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: featured ? "#fff" : "var(--ink)", margin: "0 0 8px" }}>
                {plan.name}
              </h3>

              <div style={{ margin: "0 0 4px", display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 38, fontWeight: 700, color: featured ? "#fff" : "var(--ink)", lineHeight: 1.02 }}>
                  {formatARS(price)}
                </span>
                <span style={{ fontSize: 14, color: featured ? "rgba(255,255,255,0.6)" : "var(--ink-3)" }}>/ mes</span>
              </div>
              <p
                style={{
                  fontSize: 12.5,
                  margin: "0 0 22px",
                  minHeight: 18,
                  color: annual ? (featured ? "var(--accent-2)" : "var(--green-soft)") : "transparent",
                  fontWeight: 500,
                }}
              >
                {annual
                  ? `${formatARS(plan.priceYearly)} por año · ahorrás ${formatARS((plan.priceMonthly - plan.priceMonthlyAnnual) * 12)}`
                  : "·"}
              </p>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 9,
                      fontSize: 13,
                      color: featured ? "rgba(255,255,255,0.78)" : "var(--ink-2)",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: featured ? "var(--accent)" : "var(--green)", flexShrink: 0, fontSize: 14, fontWeight: 600 }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${plan.code}&cycle=${cycle}`}
                className="lp-btn"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "13px 20px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  background: featured ? "var(--accent)" : "var(--ink)",
                  color: "#fff",
                  whiteSpace: "nowrap",
                }}
              >
                {plan.cta}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
