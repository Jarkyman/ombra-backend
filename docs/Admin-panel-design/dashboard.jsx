// Ombra Admin — Dashboard

const EVENT_COLORS = {
  conversation: '#8B7CF6',
  reading:      '#6BA98F',
  task:         '#D4956A',
  ambient:      '#A09A94',
  reflection:   '#7BB8D4',
};

const MOCK_ACTIVITY = [
  { type: 'conversation', summary: 'Quarterly roadmap discussion with Henrik and Sofie — Q3 priorities and mobile release timeline', ts: '14:32', rel: 0.91 },
  { type: 'reading',      summary: 'Article on distributed systems consensus protocols — Raft vs Paxos, Qdrant cluster applicability',  ts: '12:18', rel: 0.74 },
  { type: 'task',         summary: 'Sprint planning — backend refactor scope, estimated 3 weeks, key files identified',                ts: '11:05', rel: 0.88 },
  { type: 'ambient',      summary: 'Ambient capture during lunch break — low semantic density, minimal entities detected',             ts: '09:44', rel: 0.31 },
  { type: 'reflection',   summary: 'Morning journal — deep work strategies and energy management throughout the workday',             ts: '08:12', rel: 0.67 },
];

// ── QR code (deterministic, version-1-style 21×21) ───────────────────────
function QRCode({ tok, size = 148 }) {
  const M = 21, cell = size / M;
  const finder = (r, c, br, bc) => {
    const dr = r - br, dc = c - bc;
    if (dr < 0 || dc < 0 || dr >= 7 || dc >= 7) return null;
    if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
    if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
    return false;
  };
  const cells = [];
  for (let r = 0; r < M; r++) {
    for (let c = 0; c < M; c++) {
      let v;
      const f0 = finder(r,c,0,0), f1 = finder(r,c,0,M-7), f2 = finder(r,c,M-7,0);
      if      (f0 !== null) v = f0;
      else if (f1 !== null) v = f1;
      else if (f2 !== null) v = f2;
      else if (r === 6 || c === 6) v = (r + c) % 2 === 0;
      else if ((r === 7 && c <= 7) || (r === 7 && c >= M-8) || (r >= M-8 && c <= 7) ||
               (c === 7 && r <= 7) || (c === M-8 && r <= 7) || (c === 7 && r >= M-8)) v = false;
      else { const h = (r * 7919 + c * 6271 + 0xA8B7C6) ^ (r * 31 + c * 17); v = (h % 3) !== 0; }
      if (v) cells.push([r, c]);
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {cells.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c*cell} y={r*cell} width={cell-0.4} height={cell-0.4} rx={cell*0.1} fill={tok.textPrimary} />
      ))}
    </svg>
  );
}

function StatCard({ tok, label, value, sub, accent }) {
  return (
    <div style={{
      background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '20px 22px', boxShadow: tok.shadow1, flex: 1,
    }}>
      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: tok.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 26, color: accent || tok.textPrimary, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textMuted, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function EventPill({ type }) {
  const color = EVENT_COLORS[type] || '#A09A94';
  return (
    <div style={{
      fontFamily: MONO, fontSize: 10, color, background: `${color}18`,
      borderRadius: 6, padding: '3px 8px', letterSpacing: 0.3, whiteSpace: 'nowrap',
    }}>{type}</div>
  );
}

function KVRow({ tok, label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, borderBottom: `1px solid ${tok.borderSubtle}` }}>
      <span style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textSecondary }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 12.5, color: color || tok.textPrimary }}>{value}</span>
    </div>
  );
}

function Panel({ tok, title, children, style }) {
  return (
    <div style={{ background: tok.surfaceElevated, border: `1px solid ${tok.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: tok.shadow1, ...style }}>
      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: tok.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function DashboardContent({ tok }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top row: QR + 2×2 stat grid */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* QR code */}
        <Panel tok={tok} title="Connect app" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ background: tok.canvas, borderRadius: 10, padding: 8, border: `1px solid ${tok.border}` }}>
              <QRCode tok={tok} size={132} />
            </div>
            <div onClick={() => {}} style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 500, color: tok.accent, cursor: 'pointer',
              padding: '6px 0', width: '100%', textAlign: 'center', borderRadius: 9,
              border: `1px solid ${tok.accentBorder}`, background: tok.accentLight }}>Regenerate</div>
          </div>
        </Panel>

        {/* 2×2 stat grid */}
        <div style={{ flex: 1, minWidth: 280, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <StatCard tok={tok} label="Uptime"         value="14d 6h"  sub="Since Apr 15"          accent={tok.success} />
          <StatCard tok={tok} label="Clusters today" value="23"      sub="1,847 total"            accent={tok.accent} />
          <StatCard tok={tok} label="Model"          value="Gemma-2B" sub="Q4_K_M · 4-bit" />
          <StatCard tok={tok} label="Connections"    value="2"       sub="phone · earpiece"       accent={tok.success} />
        </div>
      </div>

      {/* Bottom row: Activity feed + compact stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Panel tok={tok} title="Recent activity" style={{ flex: 2, minWidth: 320 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {MOCK_ACTIVITY.map((item, i) => {
              const relColor = item.rel >= 0.7 ? tok.success : item.rel >= 0.5 ? tok.warning : tok.textMuted;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 0', borderBottom: i < MOCK_ACTIVITY.length - 1 ? `1px solid ${tok.borderSubtle}` : 'none' }}>
                  <EventPill type={item.type} />
                  <div style={{ flex: 1, fontFamily: SANS, fontSize: 13.5, color: tok.textSecondary, lineHeight: 1.4 }}>{item.summary}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: relColor, width: 32, textAlign: 'right' }}>{item.rel.toFixed(2)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted, width: 40, textAlign: 'right' }}>{item.ts}</div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel tok={tok} title="System" style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <KVRow tok={tok} label="Total clusters" value="1,847" />
            <KVRow tok={tok} label="Entities"       value="312" />
            <KVRow tok={tok} label="DB size"        value="312 MB" />
            <KVRow tok={tok} label="Qdrant"         value="online"  color={tok.success} />
            <KVRow tok={tok} label="Avg relevance"  value="0.71" />
            <KVRow tok={tok} label="With profile"   value="14 entities" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardContent, Panel, KVRow, StatCard, EventPill, EVENT_COLORS, MOCK_ACTIVITY });
