"use client";

import { useRouter } from "next/navigation";
import { Chat, Shop, Spark, Layers, Menu } from "./atende/Icons";

type MobileView =
  | "conversations"
  | "business"
  | "catalog"
  | "agenda"
  | "home"
  | "plan"
  | "team"
  | "connect"
  | "more"
  | "stats"
  | "support";

interface Props {
  activeView: MobileView;
}

function activeTab(activeView: MobileView): string {
  if (activeView === "conversations") return "chats";
  if (activeView === "business" || activeView === "catalog") return "business";
  if (activeView === "home") return "home";
  if (activeView === "plan") return "plan";
  if (activeView === "agenda" || activeView === "team" || activeView === "connect" || activeView === "more" || activeView === "stats" || activeView === "support") return "more";
  return "home";
}

export default function MobileTabBar({ activeView }: Props) {
  const router = useRouter();
  const active = activeTab(activeView);

  const tabs: Array<{ key: string; label: string; Icon: React.ComponentType<{ size?: number }>; href: string; center?: boolean }> = [
    { key: "chats",    label: "Chats",   Icon: Chat,   href: "/app/conversations" },
    { key: "business", label: "Negocio", Icon: Shop,   href: "/app/business" },
    { key: "home",     label: "Atendé",  Icon: Spark,  href: "/app/home", center: true },
    { key: "plan",     label: "Plan",    Icon: Layers, href: "/app/plan" },
    { key: "more",     label: "Más",     Icon: Menu,   href: "/app/more" },
  ];

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
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
