const { useState, useEffect, useRef } = React;

// ─── mock data ────────────────────────────────────────────────────────────────

const LOG_POOL = [
  { level: 'INFO',  component: 'server', message: 'WebSocket connection established',             payload: { device: 'iPhone 15 Pro', cert_hash: '287d3a1f', ip: '192.168.1.42' } },
  { level: 'DEBUG', component: 'ai',     message: 'Embedding generated (nomic-embed-text-v1.5)', payload: { dims: 768, latency_ms: 38, tokens: 142 } },
  { level: 'DEBUG', component: 'qdrant', message: 'Vector search: 3 clusters matched',            payload: { query_ms: 8.9, top_k: 5, scores: [0.89, 0.85, 0.82] } },
  { level: 'INFO',  component: 'ws',     message: 'Transcript chunk received',                    payload: { words: 28, chars: 164, device: 'iPhone 15 Pro' } },
  { level: 'INFO',  component: 'ai',     message: 'LLM inference complete',                       payload: { model: 'gemma-2-2b-q4_k_m', tokens_in: 512, tokens_out: 128, latency_ms: 842 } },
  { level: 'DEBUG', component: 'sqlite', message: 'Memory cluster persisted',                     payload: { cluster_id: 'clus_8f2a', vectors: 3, size_bytes: 4096 } },
  { level: 'WARN',  component: 'server', message: 'Client certificate expiry approaching',        payload: { device: 'MacBook Pro', days_remaining: 12, cert_serial: '4a2b' } },
  { level: 'INFO',  component: 'auth',   message: 'mTLS handshake succeeded',                     payload: { device: 'iPhone 15 Pro', cipher: 'TLS_AES_256_GCM_SHA384' } },
  { level: 'ERROR', component: 'qdrant', message: 'Upsert failed — retrying (1/3)',               payload: { error: 'connection_reset', cluster_id: 'clus_9c1b', attempt: 1 } },
  { level: 'INFO',  component: 'ble',    message: 'BLE device connected',                         payload: { name: 'Ombra-Wearable', rssi: -62, addr: 'AA:BB:CC:DD:EE:FF' } },
  { level: 'DEBUG', component: 'server', message: 'GET /api/health 200 — 1ms',                   payload: { status: 200, latency_ms: 1 } },
  { level: 'INFO',  component: 'sqlite', message: 'Vacuum complete — freed 2.4 MB',               payload: { freed_bytes: 2516582, duration_ms: 340 } },
  { level: 'WARN',  component: 'ai',     message: 'Context window near limit (95%)',              payload: { tokens_used: 3891, max_tokens: 4096, utilization: 0.95 } },
  { level: 'DEBUG', component: 'ws',     message: 'Keepalive ping/pong',                          payload: { device: 'iPhone 15 Pro', rtt_ms: 2 } },
  { level: 'INFO',  component: 'server', message: 'POST /api/query 200 — 614ms',                 payload: { status: 200, latency_ms: 614, clusters_searched: 1847 } },
  { level: 'INFO',  component: 'ai',     message: 'Entity extracted: Sarah Kim',                  payload: { entity_type: 'person', confidence: 0.94, cluster_id: 'clus_8f2a' } },
  { level: 'DEBUG', component: 'sqlite', message: 'Index rebuilt (entities)',                     payload: { rows: 312, duration_ms: 14 } },
  { level: 'INFO',  component: 'server', message: 'GET /api/memories 200 — 142ms',               payload: { status: 200, latency_ms: 142, count: 20 } },
  { level: 'WARN',  component: 'ble',    message: 'BLE signal weak — may disconnect',            payload: { rssi: -87, threshold: -80, device: 'Ombra-Wearable' } },
  { level: 'ERROR', component: 'server', message: 'TLS handshake failed — unknown client',       payload: { ip: '10.0.0.55', error: 'certificate_unknown', code: 46 } },
];

let _seq = 0;
function makeEntry(ts) {
  const base = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)];
  return {
    id:        ++_seq,
    ts:        ts ?? Date.now(),
    level:     base.level,
    component: base.component,
    message:   base.message,
    payload:   base.payload,
    trace_id:  Math.random().toString(36).slice(2, 10),
  };
}

const SEED = Array.from({ length: 24 }, (_, i) =>
  makeEntry(Date.now() - (24 - i) * 7000 + Math.random() * 2000)
).sort((a, b) => a.ts - b.ts);

const LEVELS     = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
const COMPONENTS = ['server', 'ai', 'qdrant', 'sqlite', 'auth', 'ws', 'ble'];

// ─── helpers ──────────────────────────────────────────────────────────────────

function levelColors(tok, level) {
  switch (level) {
    case 'ERROR': return { text: tok.recording, bg: tok.recordingSubtle };
    case 'WARN':  return { text: tok.warning,   bg: tok.warningSubtle   };
    case 'INFO':  return { text: tok.accent,    bg: tok.accentLight     };
    default:      return { text: tok.textMuted, bg: 'transparent'       };
  }
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
}

// ─── LogRow ───────────────────────────────────────────────────────────────────

function LogRow({ tok, log, expanded, onToggle }) {
  const c       = levelColors(tok, log.level);
  const msgColor = log.level === 'ERROR' ? tok.recording
                 : log.level === 'WARN'  ? tok.warning
                 : tok.textSecondary;
  return (
    <div
      onClick={onToggle}
      style={{
        borderBottom: `1px solid ${tok.borderSubtle}`,
        background: expanded ? tok.surfaceElevated : 'transparent',
        cursor: 'pointer',
        transition: 'background 80ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, flexShrink: 0, width: 72 }}>
          {fmtTime(log.ts)}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.7,
          padding: '2px 7px', borderRadius: 5,
          background: c.bg, color: c.text,
          flexShrink: 0, minWidth: 46, textAlign: 'center',
        }}>
          {log.level}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 10.5, color: tok.accent,
          flexShrink: 0, width: 52, letterSpacing: 0.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {log.component}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 11.5, color: msgColor,
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {log.message}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, flexShrink: 0, letterSpacing: 0.3 }}>
          {log.trace_id}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 12px 154px' }}>
          <pre style={{
            margin: 0,
            fontFamily: MONO, fontSize: 11, color: tok.textMuted, lineHeight: 1.7,
            background: tok.canvas, border: `1px solid ${tok.borderSubtle}`,
            borderRadius: 8, padding: '10px 14px', overflowX: 'auto',
          }}>
            {JSON.stringify({ trace_id: log.trace_id, timestamp_ns: log.ts * 1e6, ...log.payload }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── LogsContent ──────────────────────────────────────────────────────────────

function LogsContent({ tok }) {
  const [logs,       setLogs]      = useState(SEED);
  const [paused,     setPaused]    = useState(() => localStorage.getItem('ombra_logs_paused') === 'true');
  const [lvl,        setLvl]       = useState(() => localStorage.getItem('ombra_logs_lvl') || 'ALL');
  const [comp,       setComp]      = useState(() => localStorage.getItem('ombra_logs_comp') || 'ALL');
  const [search,     setSearch]    = useState(() => localStorage.getItem('ombra_logs_search') || '');
  const [expandedId, setExpandedId]= useState(null);
  const [missed,     setMissed]    = useState(0);

  const containerRef = useRef(null);
  const pausedRef    = useRef(false);
  pausedRef.current  = paused;

  const width    = useWindowWidth();
  const isMobile = width < 768;

  useEffect(() => localStorage.setItem('ombra_logs_paused', paused), [paused]);
  useEffect(() => localStorage.setItem('ombra_logs_lvl', lvl), [lvl]);
  useEffect(() => localStorage.setItem('ombra_logs_comp', comp), [comp]);
  useEffect(() => localStorage.setItem('ombra_logs_search', search), [search]);

  // Simulated live stream
  useEffect(() => {
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        const entry = makeEntry();
        if (pausedRef.current) {
          setMissed(n => n + 1);
        } else {
          setLogs(prev => {
            const next = [...prev, entry];
            return next.length > 1000 ? next.slice(-1000) : next;
          });
        }
        schedule();
      }, 1800 + Math.random() * 2200);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to newest entry
  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleResume = () => { setMissed(0); setPaused(false); };
  const handleClear  = () => { setLogs([]); setExpandedId(null); };

  const filtered = logs.filter(log => {
    if (lvl  !== 'ALL' && log.level     !== lvl)  return false;
    if (comp !== 'ALL' && log.component !== comp)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (!log.message.toLowerCase().includes(q) &&
          !log.component.includes(q) &&
          !log.trace_id.includes(q)) return false;
    }
    return true;
  });

  const counts = { ALL: logs.length };
  LEVELS.forEach(l => { counts[l] = logs.filter(e => e.level === l).length; });

  const logHeight = isMobile ? 'calc(100vh - 260px)' : 'calc(100vh - 230px)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'slide-up 200ms ease' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>

        {/* Level pills */}
        <div style={{
          display: 'flex', gap: 2,
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 10, padding: 3,
        }}>
          {['ALL', ...LEVELS].map(l => {
            const active = lvl === l;
            const c      = l !== 'ALL' ? levelColors(tok, l) : null;
            return (
              <button key={l} onClick={() => setLvl(l)} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.7,
                padding: '4px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', outline: 'none',
                background: active ? (c ? c.bg : tok.accentLight) : 'transparent',
                color:      active ? (c ? c.text : tok.accent)    : tok.textMuted,
                transition: 'background 100ms, color 100ms',
              }}>
                {l}
                {counts[l] > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 8.5, opacity: 0.6 }}>{counts[l]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Component select */}
        {!isMobile && (
          <select value={comp} onChange={e => setComp(e.target.value)} style={{
            fontFamily: MONO, fontSize: 11, color: tok.textSecondary,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: 8, padding: '5px 10px', cursor: 'pointer', outline: 'none',
          }}>
            <option value="ALL">all components</option>
            {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="filter…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: 11, color: tok.textSecondary,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: 8, padding: '5px 12px', outline: 'none',
            flex: 1, minWidth: isMobile ? 80 : 120,
          }}
        />

        {/* Pause / Resume */}
        <button onClick={() => paused ? handleResume() : setPaused(true)} style={{
          fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7,
          padding: '5px 14px', borderRadius: 8,
          border: `1px solid ${paused ? tok.success : tok.border}`,
          background: tok.surface,
          color: paused ? tok.success : tok.textSecondary,
          cursor: 'pointer', whiteSpace: 'nowrap', outline: 'none',
          transition: 'border-color 150ms, color 150ms',
        }}>
          {paused ? `▶ RESUME${missed ? ` +${missed}` : ''}` : '⏸ PAUSE'}
        </button>

        {/* Clear */}
        <button onClick={handleClear} style={{
          fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7,
          padding: '5px 12px', borderRadius: 8,
          border: `1px solid ${tok.border}`, background: tok.surface,
          color: tok.textMuted, cursor: 'pointer', outline: 'none',
        }}>
          CLR
        </button>
      </div>

      {/* ── Log list ── */}
      <div
        ref={containerRef}
        style={{
          height: logHeight,
          overflowY: 'auto',
          background: tok.surface,
          border: `1px solid ${tok.border}`,
          borderRadius: 12,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textDisabled, letterSpacing: 0.5 }}>
              no entries match filter
            </div>
          </div>
        ) : (
          filtered.map(log => (
            <LogRow
              key={log.id}
              tok={tok}
              log={log}
              expanded={expandedId === log.id}
              onToggle={() => setExpandedId(id => id === log.id ? null : log.id)}
            />
          ))
        )}
      </div>

      {/* ── Status bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: paused ? tok.textDisabled : tok.success,
          animation: paused ? 'none' : 'pulse-badge 2.4s ease-in-out infinite',
        }} />
        <div style={{ fontFamily: MONO, fontSize: 10, color: paused ? tok.textDisabled : tok.success, letterSpacing: 0.8 }}>
          {paused ? 'PAUSED' : 'LIVE'}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3 }}>
          {filtered.length !== logs.length
            ? `${filtered.length} / ${logs.length} entries`
            : `${logs.length} entries`}
        </div>
        {counts.ERROR > 0 && (
          <div style={{ fontFamily: MONO, fontSize: 10, color: tok.recording, letterSpacing: 0.3 }}>
            {counts.ERROR} error{counts.ERROR !== 1 ? 's' : ''}
          </div>
        )}
      </div>

    </div>
  );
}

Object.assign(window, { LogsContent });
