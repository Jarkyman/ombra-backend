const { useState, useEffect } = React;

const SECTION_COMPONENTS = {
  dashboard: (tok, dark) => <DashboardContent tok={tok} dark={dark} />,
  logs:      (tok, dark) => <LogsContent      tok={tok} dark={dark} />,
  memory:    (tok, dark) => <MemoryContent    tok={tok} dark={dark} />,
  entities:  (tok, dark) => <EntitiesContent  tok={tok} dark={dark} />,
  hardware:  (tok, dark) => <HardwareContent  tok={tok} dark={dark} />,
  analytics: (tok, dark) => <AnalyticsContent tok={tok} dark={dark} />,
  config:    (tok, dark) => <ConfigContent    tok={tok} dark={dark} />,
  devices:   (tok, dark) => <DevicesContent   tok={tok} dark={dark} />,
  profile:   (tok, dark) => <ProfileContent   tok={tok} dark={dark} />,
  trash:     (tok, dark) => <TrashContent     tok={tok} dark={dark} />,
};

function AdminApp() {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('ombra_admin_dark');
    return saved !== null ? saved === 'true' : systemDark;
  });
  const [section, setSection] = useState(() => localStorage.getItem('ombra_admin_section') || 'dashboard');
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('ombra_admin_collapsed');
    if (saved !== null) return saved === 'true';
    return window.innerWidth < 1024;
  });

  const width    = useWindowWidth();
  const isMobile = width < 768;

  useEffect(() => localStorage.setItem('ombra_admin_dark', dark), [dark]);
  useEffect(() => localStorage.setItem('ombra_admin_section', section), [section]);
  useEffect(() => localStorage.setItem('ombra_admin_collapsed', collapsed), [collapsed]);

  const tok           = dark ? OMBRA_DARK : OMBRA_LIGHT;
  const renderSection = SECTION_COMPONENTS[section];

  const handleNav = (id) => {
    setSection(id);
    if (isMobile) setCollapsed(true);
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: tok.canvas, color: tok.textPrimary,
      fontFamily: SANS, WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Mobile backdrop */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 98, backdropFilter: 'blur(1px)' }}
        />
      )}

      <AdminSidebar
        tok={tok} dark={dark}
        active={section}
        onNav={handleNav}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        onTheme={() => setDark(d => !d)}
        mobile={isMobile}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminHeader
          tok={tok}
          section={section}
          showMenu={isMobile}
          onMenuOpen={() => setCollapsed(false)}
        />
        <div style={{
          flex: 1, overflow: 'auto',
          padding: isMobile ? 12 : 20,
          background: tok.canvas,
        }}>
          {renderSection && renderSection(tok, dark)}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp />);
