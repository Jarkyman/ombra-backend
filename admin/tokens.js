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
  shadow1: '0 1px 4px rgba(0,0,0,0.4)',
  shadow2: '0 4px 16px rgba(0,0,0,0.5)',
  shadow3: '0 8px 32px rgba(0,0,0,0.6)',
};

const DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
const SANS    = '"DM Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.5, style = {} }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  switch (name) {
    case 'chevron-right':  return <svg {...s}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-left':   return <svg {...s}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'chevron-down':   return <svg {...s}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-up':     return <svg {...s}><path d="M6 15l6-6 6 6"/></svg>;
    case 'arrow-right':    return <svg {...s}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'settings':       return <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>;
    case 'home':           return <svg {...s}><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2V10z"/></svg>;
    case 'book':           return <svg {...s}><path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"/><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/></svg>;
    case 'sparkle':        return <svg {...s}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'mic':            return <svg {...s}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v4"/></svg>;
    case 'bluetooth':      return <svg {...s}><path d="M7 7l10 10-5 5V2l5 5L7 17"/></svg>;
    case 'refresh':        return <svg {...s}><path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"/></svg>;
    case 'wifi':           return <svg {...s}><path d="M2 8.8a15 15 0 0120 0M5 12.8a10 10 0 0114 0M8.5 16.4a5 5 0 017 0"/><circle cx="12" cy="20" r="0.6" fill={color}/></svg>;
    case 'check':          return <svg {...s}><path d="M5 12l5 5L20 7"/></svg>;
    case 'x':              return <svg {...s}><path d="M6 6l12 12M18 6l-12 12"/></svg>;
    case 'server':         return <svg {...s}><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>;
    case 'clock':          return <svg {...s}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'users':          return <svg {...s}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0114 0"/><circle cx="17" cy="6" r="3"/><path d="M21 15a5 5 0 00-4-2.9"/></svg>;
    case 'filter':         return <svg {...s}><path d="M3 5h18l-7 9v5l-4 2v-7L3 5z"/></svg>;
    case 'trash':          return <svg {...s}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>;
    case 'more':           return <svg {...s}><circle cx="5" cy="12" r="1" fill={color}/><circle cx="12" cy="12" r="1" fill={color}/><circle cx="19" cy="12" r="1" fill={color}/></svg>;
    case 'plus':           return <svg {...s}><path d="M12 5v14M5 12h14"/></svg>;
    case 'sun':            return <svg {...s}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    case 'moon':           return <svg {...s}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>;
    case 'waveform':       return <svg {...s}><path d="M4 12v0M8 8v8M12 5v14M16 9v6M20 11v2"/></svg>;
    case 'cpu':            return <svg {...s}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>;
    case 'database':       return <svg {...s}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v5c0 1.66 4 3 9 3s9-1.34 9-3V5M3 10v5c0 1.66 4 3 9 3s9-1.34 9-3v-5"/></svg>;
    case 'activity':       return <svg {...s}><path d="M2 12h4l3-7 4 14 3-7h6"/></svg>;
    case 'puzzle':         return <svg {...s}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01"/></svg>;
    case 'shield':         return <svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'link':           return <svg {...s}><path d="M10 13a5 5 0 007.5.7l3-3a5 5 0 00-7.1-7L11 5.5M14 11a5 5 0 00-7.5-.7l-3 3a5 5 0 007.1 7L13 18.5"/></svg>;
    case 'download':       return <svg {...s}><path d="M12 3v13M7 11l5 5 5-5M3 20h18"/></svg>;
    case 'external-link':  return <svg {...s}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>;
    case 'menu':           return <svg {...s}><path d="M3 12h18M3 6h18M3 18h18"/></svg>;
    case 'logo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
          <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={strokeWidth} strokeOpacity="0.3"/>
          <circle cx="12" cy="12" r="6"   stroke={color} strokeWidth={strokeWidth} strokeOpacity="0.6"/>
          <circle cx="12" cy="12" r="2.5" fill={color}/>
        </svg>
      );
    default:
      return <svg {...s}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

function SectionPlaceholder({ tok, icon, title, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 340, textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: tok.accentSubtle, border: `1px solid ${tok.accentBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={32} color={tok.accent} strokeWidth={1.2} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 300, fontSize: 28, color: tok.textPrimary, letterSpacing: -0.3, lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 14, color: tok.textMuted, lineHeight: 1.65 }}>
          {description}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 }}>
          Connect backend to load data
        </div>
      </div>
    </div>
  );
}

function useWindowWidth() {
  const [width, setWidth] = React.useState(() => window.innerWidth);
  React.useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

Object.assign(window, { OMBRA_LIGHT, OMBRA_DARK, DISPLAY, SANS, MONO, Icon, SectionPlaceholder, useWindowWidth });
