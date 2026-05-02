// Ombra design tokens — mirrors app-design.md exactly.

const OMBRA_LIGHT = {
  canvas: '#FAF9F7',
  surface: '#F2F0EC',
  surfaceElevated: '#FFFFFF',
  border: '#E5E1DB',
  borderSubtle: '#EEEBE7',
  textPrimary: '#1C1917',
  textSecondary: '#6B6560',
  textMuted: '#A09A94',
  textDisabled: '#C8C3BD',
  accent: '#8B7CF6',
  accentLight: '#EDE9FE',
  accentSubtle: '#F5F3FF',
  accentBorder: '#DDD6FE',
  recording: '#E57373',
  recordingSubtle: '#FEF2F2',
  success: '#6BA98F',
  successSubtle: '#F0FAF5',
  warning: '#D4956A',
  warningSubtle: '#FEF7EF',
  heroGradient: 'linear-gradient(160deg, #F5F3FF 0%, #FAF9F7 50%, #F0FAF5 100%)',
  shadow1: '0 1px 4px rgba(0,0,0,0.06)',
  shadow2: '0 4px 16px rgba(0,0,0,0.08)',
  shadow3: '0 8px 32px rgba(0,0,0,0.12)',
};

const OMBRA_DARK = {
  canvas: '#141210',
  surface: '#1E1C1A',
  surfaceElevated: '#272422',
  border: '#2E2B28',
  borderSubtle: '#252220',
  textPrimary: '#F0EDE8',
  textSecondary: '#9E9892',
  textMuted: '#6B6560',
  textDisabled: '#3D3A37',
  accent: '#8B7CF6',
  accentLight: '#1E1A3A',
  accentSubtle: '#16142B',
  accentBorder: '#3B3368',
  recording: '#E57373',
  recordingSubtle: 'rgba(229,115,115,0.12)',
  success: '#6BA98F',
  successSubtle: 'rgba(107,169,143,0.12)',
  warning: '#D4956A',
  warningSubtle: 'rgba(212,149,106,0.12)',
  heroGradient: 'linear-gradient(160deg, #1A1828 0%, #141210 50%, #12181A 100%)',
  shadow1: '0 1px 4px rgba(0,0,0,0.4)',
  shadow2: '0 4px 16px rgba(0,0,0,0.5)',
  shadow3: '0 8px 32px rgba(0,0,0,0.6)',
};

// Typography helpers — spec uses Cormorant Garamond + DM Sans + JetBrains Mono.
const DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
const SANS = '"DM Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

// Tiny inline-SVG icon set (Lucide-ish, 1.5px stroke).
function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.5, style = {} }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style,
  };
  switch (name) {
    case 'chevron-right':
      return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-left':
      return <svg {...common}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'chevron-down':
      return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-up':
      return <svg {...common}><path d="M6 15l6-6 6 6"/></svg>;
    case 'arrow-right':
      return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'arrow-up':
      return <svg {...common}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>;
    case 'home':
      return <svg {...common}><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2V10z"/></svg>;
    case 'home-fill':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2V10z"/></svg>;
    case 'book':
      return <svg {...common}><path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"/><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/></svg>;
    case 'sparkle':
      return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'mic':
      return <svg {...common}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v4"/></svg>;
    case 'map-pin':
      return <svg {...common}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'bell':
      return <svg {...common}><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></svg>;
    case 'bluetooth':
      return <svg {...common}><path d="M7 7l10 10-5 5V2l5 5L7 17"/></svg>;
    case 'refresh':
      return <svg {...common}><path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"/></svg>;
    case 'wifi':
      return <svg {...common}><path d="M2 8.8a15 15 0 0120 0M5 12.8a10 10 0 0114 0M8.5 16.4a5 5 0 017 0"/><circle cx="12" cy="20" r="0.6" fill={color}/></svg>;
    case 'check':
      return <svg {...common}><path d="M5 12l5 5L20 7"/></svg>;
    case 'x':
      return <svg {...common}><path d="M6 6l12 12M18 6l-12 12"/></svg>;
    case 'send':
      return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'server':
      return <svg {...common}><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>;
    case 'earpiece':
      return <svg {...common}><path d="M6 10a6 6 0 1112 0v3a4 4 0 01-4 4h-1v-6h3"/><path d="M6 10v3a4 4 0 004 4h1v-6H8"/></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0114 0"/><circle cx="17" cy="6" r="3"/><path d="M21 15a5 5 0 00-4-2.9"/></svg>;
    case 'filter':
      return <svg {...common}><path d="M3 5h18l-7 9v5l-4 2v-7L3 5z"/></svg>;
    case 'trash':
      return <svg {...common}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>;
    case 'more':
      return <svg {...common}><circle cx="5" cy="12" r="1" fill={color}/><circle cx="12" cy="12" r="1" fill={color}/><circle cx="19" cy="12" r="1" fill={color}/></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'sun':
      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    case 'moon':
      return <svg {...common}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>;
    case 'waveform':
      return <svg {...common}><path d="M4 12v0M8 8v8M12 5v14M16 9v6M20 11v2"/></svg>;
    case 'logo': // abstract nested-circles memory glyph
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={strokeWidth} strokeOpacity="0.3"/>
        <circle cx="12" cy="12" r="6" stroke={color} strokeWidth={strokeWidth} strokeOpacity="0.6"/>
        <circle cx="12" cy="12" r="2.5" fill={color}/>
      </svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

// A full-bleed screen inside the device content area — gives every screen
// consistent background + padding and lets the ios_frame's status bar float above.
function Screen({ tokens, children, pad = true, style = {}, background }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: background || tokens.canvas,
      color: tokens.textPrimary,
      fontFamily: SANS,
      fontSize: 16,
      lineHeight: 1.5,
      letterSpacing: -0.1,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// Status bar override that respects dark mode text color via `darkText`.
function OmbraStatusBar({ tokens, dark, time = '9:41' }) {
  const c = dark ? tokens.textPrimary : '#000';
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '21px 34px 0', height: 54, pointerEvents: 'none',
    }}>
      <div style={{
        fontFamily: '-apple-system, "SF Pro", system-ui',
        fontWeight: 600, fontSize: 16, color: c, letterSpacing: -0.3,
      }}>{time}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><path d="M0 8h3v3H0zM5 5h3v6H5zM10 2h3v9h-3zM15 0h2v11h-2z" fill={c}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke={c} strokeWidth="1.2"><path d="M1 5.5a9 9 0 0113 0M3.5 7.5a5.5 5.5 0 018 0M6 9.5a2 2 0 013 0"/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="20" height="10" rx="2.5" fill="none" stroke={c} strokeOpacity="0.6"/><rect x="2" y="2" width="17" height="7" rx="1.2" fill={c}/><rect x="21" y="3.5" width="1.5" height="4" rx="0.5" fill={c} fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
}

// Phone frame with rounded corners + dynamic island. 390 x 844 @ 1x.
function Phone({ tokens, dark, children, time = '9:41' }) {
  return (
    <div style={{
      width: 390, height: 844, borderRadius: 54, overflow: 'hidden',
      position: 'relative', background: tokens.canvas,
      boxShadow: '0 40px 80px rgba(0,0,0,0.22), 0 0 0 10px #0d0b0a, 0 0 0 11px rgba(255,255,255,0.05)',
      fontFamily: SANS, WebkitFontSmoothing: 'antialiased',
    }}>
      {/* dynamic island */}
      <div style={{
        position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
        width: 122, height: 36, borderRadius: 22, background: '#000', zIndex: 50,
      }} />
      <OmbraStatusBar tokens={tokens} dark={dark} time={time} />
      <div style={{ width: '100%', height: '100%' }}>{children}</div>
    </div>
  );
}

// Bottom tab bar — only appears on main-app screens.
function TabBar({ tokens, dark, active = 'home' }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'memory', label: 'Memory', icon: 'book' },
    { id: 'query', label: 'Ask', icon: 'sparkle' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: dark ? 'rgba(30,28,26,0.92)' : 'rgba(250,247,241,0.92)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderTop: `1px solid ${tokens.borderSubtle}`,
      paddingTop: 14, paddingBottom: 30,
      display: 'flex', justifyContent: 'space-around',
      zIndex: 40,
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        // active = subtle tonal chip behind the icon. slightly-darker surface
        // in light mode, slightly-lighter in dark mode. no accent color,
        // no dot — luxurious and quiet.
        const chipBg = isActive
          ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(28,26,23,0.055)')
          : 'transparent';
        return (
          <div key={t.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 5, minWidth: 64, padding: '0 0 2px', position: 'relative',
          }}>
            <div style={{
              width: 44, height: 30, borderRadius: 10,
              background: chipBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 180ms ease',
            }}>
              <Icon name={t.icon} size={21}
                color={isActive ? tokens.textPrimary : tokens.textMuted}
                strokeWidth={isActive ? 1.8 : 1.4} />
            </div>
            <div style={{
              fontSize: 10.5, fontWeight: isActive ? 600 : 500,
              letterSpacing: 0.3,
              color: isActive ? tokens.textPrimary : tokens.textMuted,
              fontFamily: SANS,
            }}>{t.label}</div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  OMBRA_LIGHT, OMBRA_DARK, DISPLAY, SANS, MONO,
  Icon, Screen, Phone, TabBar, OmbraStatusBar,
});
