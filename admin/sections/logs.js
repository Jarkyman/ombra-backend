const { useState, useEffect, useRef, useMemo } = React;

const LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

function levelColors(tok, level) {
  switch (level) {
    case 'ERROR': return { text: tok.recording, bg: tok.recordingSubtle };
    case 'WARN':  return { text: tok.warning,   bg: tok.warningSubtle   };
    case 'INFO':  return { text: tok.accent,    bg: tok.accentLight     };
    default:      return { text: tok.textMuted, bg: 'transparent'       };
  }
}

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString('en-GB', { hour12: false });
}

function LogRow({ tok, log, expanded, onToggle }) {
  const c        = levelColors(tok, log.level);
  const msgColor = log.level === 'ERROR' ? tok.recording
                 : log.level === 'WARN'  ? tok.warning
                 : tok.textSecondary;
  const traceId  = log.payload?.trace_id ?? String(log.id);

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
          {fmtTime(log.timestamp_ms)}
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
          flexShrink: 0, width: 64, letterSpacing: 0.2,
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
          {String(traceId).slice(0, 8)}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 12px 160px' }}>
          <pre style={{
            margin: 0,
            fontFamily: MONO, fontSize: 11, color: tok.textMuted, lineHeight: 1.7,
            background: tok.canvas, border: `1px solid ${tok.borderSubtle}`,
            borderRadius: 8, padding: '10px 14px', overflowX: 'auto',
          }}>
            {JSON.stringify({ id: log.id, timestamp_ms: log.timestamp_ms, ...log.payload }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function LogsContent({ tok }) {
  const [logs,       setLogs]       = useState([]);
  const [paused,     setPaused]     = useState(() => localStorage.getItem('ombra_logs_paused') === 'true');
  const [lvl,        setLvl]        = useState(() => localStorage.getItem('ombra_logs_lvl')    || 'ALL');
  const [comp,       setComp]       = useState(() => localStorage.getItem('ombra_logs_comp')   || 'ALL');
  const [search,     setSearch]     = useState(() => localStorage.getItem('ombra_logs_search') || '');
  const [expandedId, setExpandedId] = useState(null);
  const [missed,     setMissed]     = useState(0);

  const containerRef = useRef(null);
  const pausedRef    = useRef(false);
  const lastIdRef    = useRef(0);
  pausedRef.current  = paused;

  const width    = useWindowWidth();
  const isMobile = width < 768;

  useEffect(() => localStorage.setItem('ombra_logs_paused', paused), [paused]);
  useEffect(() => localStorage.setItem('ombra_logs_lvl',    lvl),    [lvl]);
  useEffect(() => localStorage.setItem('ombra_logs_comp',   comp),   [comp]);
  useEffect(() => localStorage.setItem('ombra_logs_search', search), [search]);

  useEffect(() => {
    const source = new EventSource('/admin/logs/stream');
    source.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        if (entry.id <= lastIdRef.current) return;
        lastIdRef.current = entry.id;
        if (pausedRef.current) {
          setMissed(n => n + 1);
        } else {
          setLogs(prev => {
            const next = [...prev, entry];
            return next.length > 1000 ? next.slice(-1000) : next;
          });
        }
      } catch {}
    };
    return () => source.close();
  }, []);

  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleResume = () => { setMissed(0); setPaused(false); };
  const handleClear  = () => { setLogs([]); setExpandedId(null); };

  const components = useMemo(() => [...new Set(logs.map(l => l.component))].sort(), [logs]);

  const filtered = logs.filter(log => {
    if (lvl  !== 'ALL' && log.level     !== lvl)  return false;
    if (comp !== 'ALL' && log.component !== comp)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (!log.message.toLowerCase().includes(q) &&
          !log.component.includes(q)) return false;
    }
    return true;
  });

  const counts = { ALL: logs.length };
  LEVELS.forEach(l => { counts[l] = logs.filter(e => e.level === l).length; });

  const logHeight = isMobile ? 'calc(100vh - 260px)' : 'calc(100vh - 230px)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'slide-up 200ms ease' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>

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

        {!isMobile && components.length > 0 && (
          <select value={comp} onChange={e => setComp(e.target.value)} style={{
            fontFamily: MONO, fontSize: 11, color: tok.textSecondary,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: 8, padding: '5px 10px', cursor: 'pointer', outline: 'none',
          }}>
            <option value="ALL">all components</option>
            {components.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

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

        <button onClick={handleClear} style={{
          fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7,
          padding: '5px 12px', borderRadius: 8,
          border: `1px solid ${tok.border}`, background: tok.surface,
          color: tok.textMuted, cursor: 'pointer', outline: 'none',
        }}>
          CLR
        </button>
      </div>

      {/* Log list */}
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
              {logs.length === 0 ? 'waiting for logs…' : 'no entries match filter'}
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

      {/* Status bar */}
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
