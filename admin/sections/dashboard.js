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

function StatCard({ tok, label, value, sub }) {
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
      {sub && (
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: tok.textMuted, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function EventPill({ tok, event, label, time }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: `1px solid ${tok.borderSubtle}` }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: tok.accent, letterSpacing: 0.3, flexShrink: 0, minWidth: 120 }}>{event}</div>
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

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(unixSeconds) {
  const diff = Date.now() - unixSeconds * 1000;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return `${h}h ago`;
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

function DashboardContent({ tok, dark }) {
  const [overview, setOverview] = useState(null);
  const [recent,   setRecent]   = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/admin/analytics/overview').then(r => r.json()),
      fetch('/clusters?limit=6').then(r => r.json()),
    ]).then(([ov, clusters]) => {
      setOverview(ov);
      setRecent(clusters);
    }).catch(() => {});
  }, []);

  const width    = useWindowWidth();
  const isMobile = width < 768;
  const qrColor  = dark ? '#F0EDE8' : '#1C1917';

  const systemRows = overview ? [
    { label: 'Total transcripts',    value: overview.total_transcripts.toLocaleString() },
    { label: 'Entities with profile', value: overview.entities_with_profile.toLocaleString() },
    { label: 'DB size',              value: formatBytes(overview.db_size_bytes) },
  ] : [];

  const statGrid = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: isMobile ? undefined : 1 }}>
      <StatCard tok={tok} label="Memory Clusters" value={overview ? overview.total_clusters.toLocaleString() : '—'} />
      <StatCard tok={tok} label="Entities"         value={overview ? overview.total_entities.toLocaleString() : '—'} />
      <StatCard tok={tok} label="Transcripts"      value={overview ? overview.total_transcripts.toLocaleString() : '—'} />
      <StatCard tok={tok} label="DB Size"          value={overview ? formatBytes(overview.db_size_bytes) : '—'} />
    </div>
  );

  const qrPanel = isMobile ? (
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

  const activityPanel = (
    <Panel tok={tok} style={{ flex: 1 }}>
      <PanelTitle tok={tok}>Recent Clusters</PanelTitle>
      {recent.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textDisabled }}>no clusters yet</div>
      ) : (
        recent.map(c => (
          <EventPill key={c.id} tok={tok} event={c.event_type} label={c.event_summary} time={relativeTime(c.started_at)} />
        ))
      )}
    </Panel>
  );

  const systemPanel = (
    <Panel tok={tok} style={{ flex: 1 }}>
      <PanelTitle tok={tok}>System Snapshot</PanelTitle>
      {systemRows.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textDisabled }}>loading…</div>
      ) : (
        systemRows.map((row, i) => (
          <KVRow key={row.label} tok={tok} label={row.label} value={row.value} valueColor={row.vc} last={i === systemRows.length - 1} />
        ))
      )}
    </Panel>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-up 200ms ease' }}>
      {isMobile ? (
        <>
          {statGrid}
          {qrPanel}
          {activityPanel}
          {systemPanel}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            {qrPanel}
            {statGrid}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            {activityPanel}
            {systemPanel}
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, { DashboardContent });
