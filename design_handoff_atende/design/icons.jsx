// icons.jsx — tiny inline SVG icon set for Atendé
// Each Ico.X is a COMPONENT FUNCTION so it works as both <Ico.X /> and {Ico.X()}.

const Ico = {};

const _make = (paths) => (props = {}) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
       stroke="currentColor" strokeWidth="1.6"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {paths}
  </svg>
);

Ico.chat = _make(<path d="M3.5 5.5C3.5 4.4 4.4 3.5 5.5 3.5h9c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2H8.6L5 16v-2.5h-.5c-.55 0-1-.45-1-1V5.5z"/>);
Ico.bolt = _make(<path d="M11 2.5L4.5 11h4.5L9 17.5 15.5 9H11l1-6.5z" />);
Ico.shop = _make(<><path d="M3.5 7.5h13L15 16H5L3.5 7.5z"/><path d="M7 7.5V5a3 3 0 0 1 6 0v2.5"/></>);
Ico.user = _make(<><circle cx="10" cy="7" r="3"/><path d="M3.5 17c.7-3 3.4-4.5 6.5-4.5s5.8 1.5 6.5 4.5"/></>);
Ico.users = _make(<><circle cx="8" cy="7.5" r="2.7"/><path d="M2.5 17c.6-2.6 2.7-4 5.5-4s4.9 1.4 5.5 4"/><path d="M14 8.5a2.5 2.5 0 0 0 0-5"/><path d="M14.5 13c2 .3 3.4 1.5 4 4"/></>);
Ico.spark = _make(<path d="M10 2.5l1.7 4.8 4.8 1.7-4.8 1.7L10 15.5 8.3 10.7 3.5 9l4.8-1.7L10 2.5z"/>);
Ico.menu = _make(<path d="M3.5 6h13M3.5 10h13M3.5 14h13"/>);
Ico.dot3 = _make(<><circle cx="4.5" cy="10" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="15.5" cy="10" r="1.2"/></>);
Ico.plus = _make(<path d="M10 4v12M4 10h12"/>);
Ico.search = _make(<><circle cx="9" cy="9" r="5.5"/><path d="M13 13l3.5 3.5"/></>);
Ico.bell = _make(<><path d="M5 14V9.5a5 5 0 0 1 10 0V14l1.5 2H3.5L5 14z"/><path d="M8.5 17a1.5 1.5 0 0 0 3 0"/></>);
Ico.qr = _make(<><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><path d="M11 11h2v2h-2zM15 11h2M11 15h2M15 13v4M17 17h0"/></>);
Ico.lock = _make(<><rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></>);
Ico.check = _make(<path d="M4 10.5L8 14l8-8"/>);
Ico.arrow = _make(<path d="M4 10h12M11 5l5 5-5 5"/>);
Ico.arrowUp = _make(<path d="M10 16V4M5 9l5-5 5 5"/>);
Ico.cog = _make(<><circle cx="10" cy="10" r="2.6"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.6 4.6l1.7 1.7M13.7 13.7l1.7 1.7M4.6 15.4l1.7-1.7M13.7 6.3l1.7-1.7"/></>);
Ico.heart = _make(<path d="M10 16.5S3.5 12.8 3.5 8.2A3.5 3.5 0 0 1 10 6a3.5 3.5 0 0 1 6.5 2.2c0 4.6-6.5 8.3-6.5 8.3z"/>);
Ico.book = _make(<><path d="M4 4h5a3 3 0 0 1 3 3v9"/><path d="M4 4v12a2 2 0 0 0 2 2h5"/><path d="M16 4h-5a3 3 0 0 0-3 3v9"/><path d="M16 4v12a2 2 0 0 1-2 2H9"/></>);
Ico.calendar = _make(<><rect x="3.5" y="5" width="13" height="11.5" rx="2"/><path d="M3.5 8.5h13M7 3.5v3M13 3.5v3"/></>);
Ico.tag = _make(<><path d="M3.5 10.5l7-7H17v6.5l-7 7-6.5-6.5z"/><circle cx="13" cy="7" r="1"/></>);
Ico.send = _make(<path d="M3 10l14-6-6 14-2-6-6-2z"/>);
Ico.mic = _make(<><rect x="8" y="3" width="4" height="9" rx="2"/><path d="M5 11a5 5 0 0 0 10 0M10 16v2"/></>);
Ico.paper = _make(<path d="M14.5 9.5l-5 5a3 3 0 0 1-4.2-4.2l6.4-6.4a2 2 0 0 1 2.8 2.8l-6.4 6.4a1 1 0 0 1-1.4-1.4l5.7-5.7"/>);
Ico.x = _make(<path d="M5 5l10 10M15 5L5 15"/>);
Ico.minus = _make(<path d="M5 10h10"/>);
Ico.shield = _make(<path d="M10 2.5l6 2.5v5c0 4-3 6.5-6 7.5-3-1-6-3.5-6-7.5V5l6-2.5z"/>);
Ico.eye = _make(<><path d="M2.5 10S5 4.5 10 4.5 17.5 10 17.5 10 15 15.5 10 15.5 2.5 10 2.5 10z"/><circle cx="10" cy="10" r="2.5"/></>);
Ico.layers = _make(<><path d="M10 2.5L2.5 6.5 10 10.5l7.5-4L10 2.5z"/><path d="M2.5 10.5L10 14.5l7.5-4M2.5 14.5L10 18.5l7.5-4"/></>);
Ico.upload = _make(<path d="M10 13V3M6 7l4-4 4 4M3.5 13v3.5h13V13"/>);
Ico.briefcase = _make(<><rect x="3" y="6.5" width="14" height="9" rx="2"/><path d="M7.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 12.5 5v1.5"/></>);
Ico.copy = _make(<><rect x="6" y="6" width="10" height="10" rx="2"/><path d="M14 6V4.5A1.5 1.5 0 0 0 12.5 3H5.5A1.5 1.5 0 0 0 4 4.5v8A1.5 1.5 0 0 0 5.5 14"/></>);
Ico.flag = _make(<path d="M5 17V3M5 4h9l-1.5 3L14 10H5"/>);

// circular avatar with initials
function Avatar({ initials = 'JM', size = 36, bg, fg }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: bg || 'var(--surface-2)',
      color: fg || 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Geist Mono, monospace', fontSize: size * 0.35, fontWeight: 500,
      border: '1px solid var(--hairline)',
      flex: '0 0 auto',
    }}>{initials}</div>
  );
}

Object.assign(window, { Ico, Avatar });
