"use client";

import { useRouter } from "next/navigation";
import { Chat, Shop, Spark, Bolt, Layers, Calendar, Menu } from "./atende/Icons";
import { canAccessView, type DashboardRole, type DashboardView } from "@/lib/role-access";

type MobileView = DashboardView;

interface Props {
  activeView: MobileView;
  role?: DashboardRole;
}

function activeTab(activeView: MobileView): string {
  if (activeView === "conversations") return "chats";
  if (activeView === "catalog") return "catalog";
  if (activeView === "business") return "business";
  if (activeView === "home") return "home";
  if (activeView === "agenda") return "agenda";
  // Plan, Equipo, WhatsApp, Métricas y Soporte viven dentro de "Más".
  return "more";
}

export default function MobileTabBar({ activeView, role = "owner" }: Props) {
  const router = useRouter();
  const active = activeTab(activeView);

  // Las 2 superficies para entrenar el bot van en la barra (Catálogo + Asistente),
  // que es el diferencial. Plan y Turnos quedan en "Más" (uso ocasional).
  // El filtro por rol y el tope de 5 se encargan del resto.
  const allTabs: Array<{ key: string; view: DashboardView; label: string; Icon: React.ComponentType<{ size?: number }>; href: string; center?: boolean }> = [
    { key: "chats",    view: "conversations", label: "Chats",     Icon: Chat,     href: "/app/conversations" },
    { key: "catalog",  view: "catalog",       label: "Catálogo",  Icon: Bolt,     href: "/app/catalog" },
    { key: "home",     view: "home",          label: "Inicio",    Icon: Spark,    href: "/app/home", center: true },
    { key: "business", view: "business",      label: "Asistente", Icon: Shop,     href: "/app/business" },
    { key: "plan",     view: "plan",          label: "Plan",      Icon: Layers,   href: "/app/plan" },
    { key: "agenda",   view: "agenda",        label: "Turnos",    Icon: Calendar, href: "/app/agenda" },
    { key: "more",     view: "more",          label: "Más",       Icon: Menu,     href: "/app/more" },
  ];

  // Máximo 5 tabs. Para owner/admin, Plan y Turnos se quedan en "Más".
  // Para el Operador (sin catálogo/asistente/plan) entra Turnos.
  let tabs = allTabs.filter(({ view }) => canAccessView(role, view));
  if (tabs.length > 5) tabs = tabs.filter(({ key }) => key !== "plan");
  if (tabs.length > 5) tabs = tabs.filter(({ key }) => key !== "agenda");

  return (
    <nav className="atd-tabbar md:hidden">
      {tabs.map(({ key, label, Icon, href, center }) => (
        <button
          key={key}
          onClick={() => {
            if (key === "chats") {
              window.dispatchEvent(new Event("atende:show-conversation-list"));
            }
            router.push(href);
          }}
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
