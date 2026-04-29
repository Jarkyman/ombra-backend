// Ombra Admin — Logs

const MOCK_LOGS = [
  { level: 'info',  component: 'ingestion', msg: 'Cluster formed',            cluster_id: 'cl_8f2a3b', entropy: 0.73,                  ts: '14:32:18.441' },
  { level: 'info',  component: 'ai',        msg: 'Embedding generated',        model: 'gemma-2-2b', tokens: 312,                        ts: '14:32:17.208' },
  { level: 'debug', component: 'websocket', msg: 'Heartbeat received',          device: 'ombra-ear-01',                                  ts: '14:32:15.001' },
  { level: 'info',  component: 'ingestion', msg: 'Transcript chunk processed',  duration_ms: 142,                                        ts: '14:31:52.774' },
  { level: 'warn',  component: 'ai',        msg: 'Token limit approaching',     tokens: 3841, limit: 4096,                               ts: '14:31:48.330' },
  { level: 'debug', component: 'websocket', msg: 'Heartbeat received',          device: 'ombra-phone',                                   ts: '14:31:45.002' },
  { level: 'info',  component: 'ingestion', msg: 'Entity extracted',            name: 'Sofie', type: 'person',                           ts: '14:31:41.119' },
  { level: 'info',  component: 'ai',        msg: 'Summary generated',           tokens_in: 892, tokens_out: 84,                          ts: '14:31:38.562' },
  { level: 'error', component: 'ai',        msg: 'Inference timeout',           after_ms: 8000,                                          ts: '14:30:12.771' },
  { level: 'info',  component: 'ingestion', msg: 'Cluster formed',              cluster_id: 'cl_7e1a9c', entropy: 0.88,                  ts: '14:28:55.004' },
  { level: 'debug', component: 'storage',   msg: 'SQLite checkpoint',            pages: 412,                                              ts: '14:28:00.003' },
  { level: 'info',  component: 'ingestion', msg: 'Transcript chunk processed',  duration_ms: 138,                                        ts: '14:27:44.219' },
  { level: 'info',  component: 'websocket', msg: 'Client connected',             device: 'ombra-phone', ip: '192.168.1.55',              ts: '14:26:02.881' },
  { level: 'debug', component: 'websocket', msg: 'Heartbeat received',           device: 'ombra-ear-01',                                  ts: '14:25:15.000' },
  { level: 'info',  component: 'ai',        msg: 'Profile updated',              entity: 'Henrik',                                        ts: '14:22:33.446' },
  { level: 'info',  component: 'ingestion', msg: 'Entity extracted',             name: 'roadmap', type: 'concept',                        ts: '14:21:10.882' },
  { level: 'warn',  component: 'storage',   msg: 'DB size approaching limit',    size_mb: 847, limit_mb: 1024,                           ts: '14:20:00.001' },
  { level: 'debug', component: 'ai',        msg: 'Context window used',          tokens: 2104, pct: 51,                                  ts: '14:19:55.331' },
  { level: 'info',  component: 'ingestion', msg: 'Cluster closed — timeout',     cluster_id: 'cl_6d0b2f', reason: 'idle',                ts: '14:18:45.009' },
  { level: 'info',  component: 'websocket', msg: 'Client disconnected',          device: 'ombra-phone', code: 1000,                      ts: '14:15:03.114' },
];

const LEVEL_COLORS    = { info: '#8B7CF6', debug: '#A09A94', warn: '#D4956A', error: '#E57373' };
const COMPONENT_COLORS = { ingestion: '#6BA98F', ai: '#8B7CF6', websocket: '#7BB8D4', storage: '#D4956A' };
const LOG_LEVELS = ['all', 'error', 'warn', 'info', 'debug'];

function LogEntry({ entry, tok }) {
  const lc = LEVEL_COLORS[entry.level]    || tok.textMuted;
  const cc = COMPONENT_COLORS[entry.component] || tok.textMuted;
  const extra = Object.entries(entry)
    .filter(([k]) => !['level','component','msg','ts'].includes(k))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'baseline',
      padding: '4px 0', borderBottom: `1px solid ${tok.borderSubtle}`,
      fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7,
    }}>
      <span style={{ color: tok.textMuted, width: 98, flexShrink: 0 }}>{entry.ts}</span>
      <span style={{ color: lc, width: 40, flexShrink: 0, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: 0.6, paddingTop: 2 }}>{entry.level}</span>
      <span style={{ color: cc, width: 84, flexShrink: 0 }}>{entry.component}</span>
      <span style={{ color: tok.textPrimary }}>{entry.msg}</span>
      {extra && <span style={{ color: tok.textMuted, flex: 1 }}>{extra}</span>}
    </div>
  );
}

function Chip({ active, label, onClick, tok, activeColor }) {
  return (
    <div onClick={onClick} style={{
      fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase',
      padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
      background: active ? (activeColor || tok.accent) : tok.surface,
      color: active ? '#fff' : tok.textSecondary,
      border: `1px solid ${active ? (activeColor || tok.accent) : tok.border}`,
      transition: 'all 120ms',
    }}>{label}</div>
  );
}

function LogsContent({ tok }) {
  const [filter, setFilter]   = React.useState('all');
  const [paused, setPaused]   = React.useState(false);
  const filtered = filter === 'all' ? MOCK_LOGS : MOCK_LOGS.filter(l => l.level === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 144px)' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        {LOG_LEVELS.map(l => (
          <Chip key={l} label={l} active={filter === l} onClick={() => setFilter(l)} tok={tok}
            activeColor={l === 'error' ? LEVEL_COLORS.error : l === 'warn' ? LEVEL_COLORS.warn : undefined} />
        ))}
        <div style={{ flex: 1 }} />
        <Chip label={paused ? '▶ Resume' : '⏸ Pause'} active={paused} onClick={() => setPaused(p => !p)} tok={tok} activeColor={tok.warning} />
        <Chip label="Clear" active={false} onClick={() => {}} tok={tok} />
      </div>

      {/* Stream */}
      <div style={{
        flex: 1, overflow: 'auto',
        background: tok.canvas, border: `1px solid ${tok.border}`,
        borderRadius: 14, padding: '12px 16px',
      }}>
        {paused && (
          <div style={{
            fontFamily: SANS, fontSize: 12, color: tok.warning,
            background: tok.warningSubtle, borderRadius: 8,
            padding: '6px 12px', marginBottom: 10,
          }}>Stream paused — 3 new entries waiting</div>
        )}
        {filtered.map((entry, i) => <LogEntry key={i} entry={entry} tok={tok} />)}
      </div>
    </div>
  );
}

Object.assign(window, { LogsContent, Chip });
