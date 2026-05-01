const ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home'     },
  { id: 'logs',      label: 'Logs',      icon: 'waveform' },
  { id: 'memory',    label: 'Memory',    icon: 'book'     },
  { id: 'entities',  label: 'Entities',  icon: 'users'    },
  { id: 'hardware',  label: 'Hardware',  icon: 'server'   },
  { id: 'analytics', label: 'Analytics', icon: 'sparkle'  },
  'divider',
  { id: 'config',    label: 'Config',    icon: 'settings' },
  { id: 'devices',   label: 'Devices',   icon: 'bluetooth'},
  { id: 'profile',   label: 'Profile',   icon: 'mic'      },
  { id: 'trash',     label: 'Trash',     icon: 'trash'    },
];

const SECTION_META = {
  dashboard: { title: 'Dashboard',     sub: 'System health at a glance'                   },
  logs:      { title: 'Logs',          sub: 'Live JSONL stream from ombra-server'          },
  memory:    { title: 'Memory',        sub: 'Browsable memory clusters'                   },
  entities:  { title: 'Entities',      sub: 'Force-directed entity relationship graph'    },
  hardware:  { title: 'Hardware',      sub: 'CPU · RAM · Temperature · Disk · Network'    },
  analytics: { title: 'Analytics',     sub: 'All charts update with the selected time range'},
  config:    { title: 'Configuration', sub: 'Server settings and certificates'            },
  devices:   { title: 'Devices',       sub: 'Trusted mTLS client certificates'            },
  profile:   { title: 'User Profile',  sub: 'AI-generated context injected on every query'},
  plugins:   { title: 'Plugins',       sub: 'Extend Ombra with official and community plugins'},
  trash:     { title: 'Trash',         sub: 'Clusters flagged for deletion'               },
};

function AdminSidebar({ tok, dark, active, onNav, collapsed, onToggle, onTheme, hasUpdate = false, mobile = false }) {
  const containerStyle = mobile ? {
    position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
    width: 240,
    background: tok.surface,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden', flexShrink: 0,
    boxShadow: tok.shadow3,
    transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
    transition: 'transform 240ms cubic-bezier(0.4,0,0.2,1)',
  } : {
    width: collapsed ? 64 : 240,
    background: tok.surface,
    borderRight: `1px solid ${tok.border}`,
    display: 'flex', flexDirection: 'column',
    transition: 'width 220ms ease',
    overflow: 'hidden', flexShrink: 0,
    minHeight: '100vh',
  };

  return (
    <div style={containerStyle}>
      {/* Logo row */}
      <div style={{
        height: 64, display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 10,
        borderBottom: `1px solid ${tok.borderSubtle}`, flexShrink: 0,
      }}>
        <div
          onClick={collapsed ? onToggle : undefined}
          style={{ cursor: collapsed ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, flexShrink: 0 }}
        >
          <Icon name="logo" size={26} color={tok.accent} />
        </div>
        {!collapsed && (
          <>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 16, letterSpacing: -0.2, color: tok.textPrimary, lineHeight: 1.1 }}>Ombra</div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.8, textTransform: 'uppercase', color: tok.textMuted }}>admin panel</div>
            </div>
            <div onClick={onToggle} style={{ cursor: 'pointer', color: tok.textMuted, padding: 4, lineHeight: 0, flexShrink: 0 }}>
              <Icon name="chevron-left" size={15} />
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {ADMIN_NAV.map((item, i) => {
          if (item === 'divider') {
            return <div key={i} style={{ height: 1, background: tok.borderSubtle, margin: '8px 4px' }} />;
          }
          const isActive = active === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onNav(item.id)}
              title={collapsed ? item.label : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '9px 0' : '8px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10, cursor: 'pointer',
                background: isActive ? tok.accentLight : 'transparent',
                color: isActive ? tok.accent : tok.textSecondary,
                fontFamily: SANS, fontSize: 13.5, fontWeight: isActive ? 500 : 400,
                transition: 'background 120ms', whiteSpace: 'nowrap', position: 'relative',
              }}
            >
              {collapsed && isActive && (
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: tok.accent, borderRadius: '0 2px 2px 0' }} />
              )}
              <Icon name={item.icon} size={16} color={isActive ? tok.accent : tok.textSecondary} strokeWidth={isActive ? 2 : 1.5} />
              {!collapsed && item.label}
            </div>
          );
        })}
      </div>

      {/* Footer: theme toggle + version */}
      <div style={{ borderTop: `1px solid ${tok.borderSubtle}`, padding: '8px 8px 0' }}>
        <div
          onClick={onTheme}
          title="Toggle theme"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: collapsed ? '9px 0' : '8px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 10, cursor: 'pointer',
            color: tok.textMuted, fontFamily: SANS, fontSize: 12.5,
          }}
        >
          <Icon name={dark ? 'sun' : 'moon'} size={16} color={tok.textMuted} />
          {!collapsed && (dark ? 'Light mode' : 'Dark mode')}
        </div>

        {!collapsed && (
          <div style={{ padding: '4px 12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3 }}>v0.4.2</div>
            {hasUpdate && (
              <div style={{
                fontFamily: SANS, fontSize: 10, fontWeight: 600, color: '#fff',
                background: tok.warning, borderRadius: 5, padding: '2px 7px',
                letterSpacing: 0.2, cursor: 'pointer',
                animation: 'pulse-badge 2.4s ease-in-out infinite',
              }}>Update</div>
            )}
          </div>
        )}
        {collapsed && hasUpdate && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 14px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: tok.warning, animation: 'pulse-badge 2.4s ease-in-out infinite' }} title="Update available" />
          </div>
        )}
        {collapsed && !hasUpdate && <div style={{ height: 14 }} />}
      </div>
    </div>
  );
}

function AdminHeader({ tok, section, showMenu = false, onMenuOpen }) {
  const meta = SECTION_META[section] || { title: section, sub: '' };
  return (
    <div style={{
      height: 64, display: 'flex', alignItems: 'center',
      padding: '0 20px', borderBottom: `1px solid ${tok.border}`,
      background: tok.canvas, flexShrink: 0, gap: 12,
    }}>
      {showMenu && (
        <div
          onClick={onMenuOpen}
          style={{ cursor: 'pointer', padding: 6, lineHeight: 0, borderRadius: 8, flexShrink: 0, color: tok.textMuted }}
        >
          <Icon name="menu" size={20} color={tok.textMuted} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 300, fontSize: 22, letterSpacing: -0.4, color: tok.textPrimary, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {meta.title}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: tok.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {meta.sub}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminSidebar, AdminHeader, ADMIN_NAV, SECTION_META });
