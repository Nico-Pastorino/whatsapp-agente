"use client";

import { useRouter } from "next/navigation";
import { Chat, Shop, Spark, Layers, Calendar, Menu } from "./atende/Icons";
import { canAccessView, type DashboardRole, type DashboardView } from "@/lib/role-access";

type MobileView = DashboardView;

interface Props {
  activeView: MobileView;
  role?: DashboardRole;
}

function activeTab(activeView: MobileView): string {
  if (activeView === "conversations") return "chats";
  if (activeView === "business" || activeView === "catalog") return "business";
  if (activeView === "home") return "home";
  if (activeView === "plan") return "plan";
  if (activeView === "agenda") return "agenda";
  if (activeView === "team" || activeView === "connect" || activeView === "more" || activeView === "stats" || activeView === "support") return "more";
  return "home";
}

export default function MobileTabBar({ activeView, role = "owner" }: Props) {
  const router = useRouter();
  const active = activeTab(activeView);

  // Cada tab declara la vista que representa; se filtra por rol igual que la sidebar.
  // Para Operador/Admin, "Plan" (y "Negocio" en el caso del Operador) desaparecen
  // y entra "Turnos" (agenda) para no dejar la barra vacía.
  const allTabs: Array<{ key: string; view: DashboardView; label: string; Icon: React.ComponentType<{ size?: number }>; href: string; center?: boolean }> = [
    { key: "chats",    view: "conversations", label: "Chats",   Icon: Chat,     href: "/app/conversations" },
    { key: "business", view: "business",      label: "Negocio", Icon: Shop,     href: "/app/business" },
    { key: "home",     view: "home",          label: "Atendé",  Icon: Spark,    href: "/app/home", center: true },
    { key: "plan",     view: "plan",          label: "Plan",    Icon: Layers,   href: "/app/plan" },
    { key: "agenda",   view: "agenda",        label: "Turnos",  Icon: Calendar, href: "/app/agenda" },
    { key: "more",     view: "more",          label: "Más",     Icon: Menu,     href: "/app/more" },
  ];

  // Máximo 5 tabs: si el rol ve "business" y "plan" (owner), "agenda" se queda
  // en "Más" como hasta ahora. Para admin/agent entra agenda en su lugar.
  let tabs = allTabs.filter(({ view }) => canAccessView(role, view));
  if (tabs.length > 5) {
    tabs = tabs.filter(({ key }) => key !== "agenda");
  }

  return (
    <nav className="atd-tabbar md:hidden">
      {tabs.map(({ key, label, Icon, href, center }) => (
        <button
          key={key}
          onClick={() => router.push(href)}
          className={`atd-tab ${active === key ? "active" : ""} ${center ? "center" : ""}`}
        >
          <span className="tab-ic">
            <Icon size={18} />
          </span>
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
