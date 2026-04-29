const { useState, useEffect } = React;

function QRCode({ value, size = 160, color }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const N = qr.getModuleCount();
  const cell = size / N;
  const rects = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (qr.isDark(r, c)) {
        rects.push(
          <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={color} />
        );
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rects}
    </svg>
  );
}

function Panel({ tok, children, style = {} }) {
  return (
    <div style={{
      background: tok.surface,
      border: `1px solid ${tok.border}`,
      borderRadius: 16,
      padding: 20,
      boxShadow: tok.shadow1,
      ...style,
    }}>
      {children}
    </div>
  );
}

function PanelTitle({ tok, children }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function StatCard({ tok, label, value, delta, deltaColor }) {
  return (
    <div style={{
      background: tok.surfaceElevated,
      border: `1px solid ${tok.border}`,
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: tok.textMuted }}>{label}</div>
      <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 26, color: tok.textPrimary, lineHeight: 1, letterSpacing: -0.5 }}>{value}</div>
      {delta && (
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: deltaColor || tok.textMuted, marginTop: 2 }}>{delta}</div>
      )}
    </div>
  );
}

function EventPill({ tok, event, label, time, accentColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: `1px solid ${tok.borderSubtle}` }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: accentColor || tok.accent, letterSpacing: 0.3, flexShrink: 0, minWidth: 140 }}>{event}</div>
      <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, flexShrink: 0 }}>{time}</div>
    </div>
  );
}

function KVRow({ tok, label, value, valueColor, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '7px 0',
      borderBottom: last ? 'none' : `1px solid ${tok.borderSubtle}`,
    }}>
      <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textMuted }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 11.5, color: valueColor || tok.textSecondary, letterSpacing: 0.2 }}>{value}</div>
    </div>
  );
}

const MOCK_ACTIVITY = [
  { event: 'memory:saved',       label: 'Book club discussion',      time: '2m ago',  color: null },
  { event: 'query:answered',     label: '842ms · 3 clusters matched',time: '8m ago',  color: '#6BA98F' },
  { event: 'device:seen',        label: 'iPhone 15 Pro',             time: '14m ago', color: null },
  { event: 'entity:linked',      label: 'Sarah Kim → Project Lumen', time: '1h ago',  color: null },
  { event: 'memory:flagged',     label: 'Flagged for review',        time: '3h ago',  color: '#D4956A' },
  { event: 'device:provisioned', label: 'MacBook Pro added',         time: '1d ago',  color: '#6BA98F' },
];

const MOCK_SYSTEM = [
  { label: 'Model',       value: 'gemma-2-2b-q4_k_m'         },
  { label: 'Host',        value: 'ombra.local'                },
  { label: 'Version',     value: 'v0.4.2'                    },
  { label: 'Client cert', value: '287d remaining', vc: '#6BA98F' },
  { label: 'Server cert', value: '312d remaining', vc: '#6BA98F' },
  { label: 'SQLite',      value: '147.2 MB'                  },
  { label: 'Qdrant',      value: '89.4 MB · 1,847 vectors'   },
];

function DashboardContent({ tok, dark }) {
  const [uptime, setUptime] = useState('14d 6h 23m');

  useEffect(() => {
    let secs = 14 * 86400 + 6 * 3600 + 23 * 60;
    const id = setInterval(() => {
      secs++;
      const d = Math.floor(secs / 86400);
      const h = Math.floor((secs % 86400) / 3600);
      const m = Math.floor((secs % 3600) / 60);
      setUptime(`${d}d ${h}h ${m}m`);
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const width    = useWindowWidth();
  const isMobile = width < 768;
  const qrColor  = dark ? '#F0EDE8' : '#1C1917';

  const statGrid = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: isMobile ? undefined : 1 }}>
      <StatCard tok={tok} label="Memory Clusters" value="1,847" delta="+12 today" deltaColor={tok.success} />
      <StatCard tok={tok} label="Entities"         value="312"   delta="+3 today"  deltaColor={tok.success} />
      <StatCard tok={tok} label="Queries today"    value="28"    delta="avg 614ms" />
      <StatCard tok={tok} label="Uptime"           value={uptime} delta="since last restart" />
    </div>
  );

  const qrPanel = isMobile ? (
    /* Compact horizontal strip on mobile */
    <Panel tok={tok} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ padding: 6, background: dark ? tok.surfaceElevated : '#fff', borderRadius: 10, border: `1px solid ${tok.borderSubtle}`, flexShrink: 0 }}>
        <QRCode value="ombra.local:8443/provision" size={80} color={qrColor} />
      </div>
      <div>
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted, marginBottom: 4 }}>Add Device</div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: tok.textSecondary }}>ombra.local:8443</div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted, marginTop: 2 }}>mTLS · scan to provision</div>
      </div>
    </Panel>
  ) : (
    /* Portrait panel on desktop */
    <Panel tok={tok} style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <PanelTitle tok={tok}>Add Device</PanelTitle>
      <div style={{ padding: 8, background: dark ? tok.surfaceElevated : '#fff', borderRadius: 12, border: `1px solid ${tok.borderSubtle}` }}>
        <QRCode value="ombra.local:8443/provision" size={148} color={qrColor} />
      </div>
      <div style={{ width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textSecondary, letterSpacing: 0.3 }}>ombra.local:8443</div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted, marginTop: 3 }}>mTLS · scan to provision</div>
      </div>
    </Panel>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-up 200ms ease' }}>

      {isMobile ? (
        /* Mobile: stats first, then QR, then feeds stacked */
        <>
          {statGrid}
          {qrPanel}
          <Panel tok={tok}>
            <PanelTitle tok={tok}>Recent Activity</PanelTitle>
            {MOCK_ACTIVITY.map((e, i) => (
              <EventPill key={i} tok={tok} event={e.event} label={e.label} time={e.time} accentColor={e.color} />
            ))}
          </Panel>
          <Panel tok={tok}>
            <PanelTitle tok={tok}>System Snapshot</PanelTitle>
            {MOCK_SYSTEM.map((row, i) => (
              <KVRow key={row.label} tok={tok} label={row.label} value={row.value} valueColor={row.vc} last={i === MOCK_SYSTEM.length - 1} />
            ))}
          </Panel>
        </>
      ) : (
        /* Desktop: QR + stat grid side by side, then activity + system side by side */
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            {qrPanel}
            {statGrid}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            <Panel tok={tok} style={{ flex: 1 }}>
              <PanelTitle tok={tok}>Recent Activity</PanelTitle>
              {MOCK_ACTIVITY.map((e, i) => (
                <EventPill key={i} tok={tok} event={e.event} label={e.label} time={e.time} accentColor={e.color} />
              ))}
            </Panel>
            <Panel tok={tok} style={{ flex: 1 }}>
              <PanelTitle tok={tok}>System Snapshot</PanelTitle>
              {MOCK_SYSTEM.map((row, i) => (
                <KVRow key={row.label} tok={tok} label={row.label} value={row.value} valueColor={row.vc} last={i === MOCK_SYSTEM.length - 1} />
              ))}
            </Panel>
          </div>
        </>
      )}

    </div>
  );
}

Object.assign(window, { DashboardContent });
