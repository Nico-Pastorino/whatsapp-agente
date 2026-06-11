// Atendé icon set — 20×20 viewBox, stroke 1.6, rounded caps
// Ported from design_handoff_atende/design/icons.jsx

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode) {
  return function Icon({ size = 20, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const Chat = make(
  <path d="M3.5 5.5C3.5 4.4 4.4 3.5 5.5 3.5h9c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2H8.6L5 16v-2.5h-.5c-.55 0-1-.45-1-1V5.5z" />
);
export const Bolt = make(
  <path d="M11 2.5L4.5 11h4.5L9 17.5 15.5 9H11l1-6.5z" />
);
export const Calendar = make(
  <>
    <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
    <path d="M3.5 8h13M7 3v3M13 3v3" />
  </>
);
export const Shop = make(
  <>
    <path d="M3.5 7.5h13L15 16H5L3.5 7.5z" />
    <path d="M7 7.5V5a3 3 0 0 1 6 0v2.5" />
  </>
);
export const User = make(
  <>
    <circle cx="10" cy="7" r="3" />
    <path d="M3.5 17c.7-3 3.4-4.5 6.5-4.5s5.8 1.5 6.5 4.5" />
  </>
);
export const Users = make(
  <>
    <circle cx="8" cy="7.5" r="2.7" />
    <path d="M2.5 17c.6-2.6 2.7-4 5.5-4s4.9 1.4 5.5 4" />
    <path d="M14 8.5a2.5 2.5 0 0 0 0-5" />
    <path d="M14.5 13c2 .3 3.4 1.5 4 4" />
  </>
);
export const Spark = make(
  <path d="M10 2.5l1.7 4.8 4.8 1.7-4.8 1.7L10 15.5 8.3 10.7 3.5 9l4.8-1.7L10 2.5z" />
);
export const Menu = make(
  <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
);
export const Dot3 = make(
  <>
    <circle cx="4.5" cy="10" r="1.2" />
    <circle cx="10" cy="10" r="1.2" />
    <circle cx="15.5" cy="10" r="1.2" />
  </>
);
export const Plus = make(
  <path d="M10 4v12M4 10h12" />
);
export const Search = make(
  <>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13 13l3.5 3.5" />
  </>
);
export const Bell = make(
  <>
    <path d="M5 14V9.5a5 5 0 0 1 10 0V14l1.5 2H3.5L5 14z" />
    <path d="M8.5 17a1.5 1.5 0 0 0 3 0" />
  </>
);
export const QR = make(
  <>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="11" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="11" width="6" height="6" rx="1" />
    <path d="M11 11h2v2h-2zM15 11h2M11 15h2M15 13v4M17 17h0" />
  </>
);
export const Lock = make(
  <>
    <rect x="4" y="9" width="12" height="8" rx="2" />
    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
  </>
);
export const Check = make(
  <path d="M4 10.5L8 14l8-8" />
);
export const Arrow = make(
  <path d="M4 10h12M11 5l5 5-5 5" />
);
export const ArrowUp = make(
  <path d="M10 16V4M5 9l5-5 5 5" />
);
export const ArrowLeft = make(
  <path d="M12 5l-5 5 5 5" />
);
export const Cog = make(
  <>
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.6 4.6l1.7 1.7M13.7 13.7l1.7 1.7M4.6 15.4l1.7-1.7M13.7 6.3l1.7-1.7" />
  </>
);
export const Layers = make(
  <>
    <path d="M10 2.5L2.5 6.5 10 10.5l7.5-4L10 2.5z" />
    <path d="M2.5 10.5L10 14.5l7.5-4M2.5 14.5L10 18.5l7.5-4" />
  </>
);
export const Send = make(
  <path d="M3 10l14-6-6 14-2-6-6-2z" />
);
export const Mic = make(
  <>
    <rect x="8" y="3" width="4" height="9" rx="2" />
    <path d="M5 11a5 5 0 0 0 10 0M10 16v2" />
  </>
);
export const X = make(
  <path d="M5 5l10 10M15 5L5 15" />
);
export const Minus = make(
  <path d="M5 10h10" />
);
export const Copy = make(
  <>
    <rect x="6" y="6" width="10" height="10" rx="2" />
    <path d="M14 6V4.5A1.5 1.5 0 0 0 12.5 3H5.5A1.5 1.5 0 0 0 4 4.5v8A1.5 1.5 0 0 0 5.5 14" />
  </>
);
export const Eye = make(
  <>
    <path d="M2.5 10S5 4.5 10 4.5 17.5 10 17.5 10 15 15.5 10 15.5 2.5 10 2.5 10z" />
    <circle cx="10" cy="10" r="2.5" />
  </>
);
export const Flag = make(
  <path d="M5 17V3M5 4h9l-1.5 3L14 10H5" />
);

// Avatar component
interface AvatarProps {
  initials: string;
  size?: number;
  bg?: string;
  fg?: string;
}
export function Avatar({ initials, size = 36, bg, fg }: AvatarProps) {
  return (
    <div
      className="atd-av"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: bg,
        color: fg,
      }}
    >
      {initials}
    </div>
  );
}

export const BarChart = make(
  <>
    <rect x="3" y="10" width="3.5" height="7" rx="1" />
    <rect x="8.25" y="6" width="3.5" height="11" rx="1" />
    <rect x="13.5" y="3" width="3.5" height="14" rx="1" />
  </>
);

// Salvavidas — usado para Soporte / Ayuda
export const LifeBuoy = make(
  <>
    <circle cx="10" cy="10" r="7.5" />
    <circle cx="10" cy="10" r="3" />
    <path d="M4.7 4.7l2.7 2.7M12.6 12.6l2.7 2.7M15.3 4.7l-2.7 2.7M7.4 12.6l-2.7 2.7" />
  </>
);

// Tema / apariencia
export const Sun = make(
  <>
    <circle cx="10" cy="10" r="3.4" />
    <path d="M10 2.2v2.1M10 15.7v2.1M2.2 10h2.1M15.7 10h2.1M4.5 4.5L6 6M14 14l1.5 1.5M15.5 4.5L14 6M6 14l-1.5 1.5" />
  </>
);
export const Moon = make(
  <path d="M16.5 11.7A6.6 6.6 0 0 1 8.3 3.5a6.6 6.6 0 1 0 8.2 8.2z" />
);
export const Monitor = make(
  <>
    <rect x="3" y="4" width="14" height="9.5" rx="2" />
    <path d="M8 17h4M10 13.5V17" />
  </>
);

// Salir de la cuenta
export const Logout = make(
  <>
    <path d="M12.5 3.5H6.8A2.3 2.3 0 0 0 4.5 5.8v8.4a2.3 2.3 0 0 0 2.3 2.3h5.7" />
    <path d="M9 10h8M14 7l3 3-3 3" />
  </>
);
