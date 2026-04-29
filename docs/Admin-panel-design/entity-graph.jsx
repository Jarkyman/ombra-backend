// Ombra Admin — Entity Graph

const ENT_NODES = [
  { id: 'henrik',   label: 'Henrik',   type: 'person',     count: 47 },
  { id: 'sofie',    label: 'Sofie',    type: 'person',     count: 31 },
  { id: 'ombra',    label: 'Ombra',    type: 'project',    count: 89 },
  { id: 'rust',     label: 'Rust',     type: 'technology', count: 23 },
  { id: 'flutter',  label: 'Flutter',  type: 'technology', count: 18 },
  { id: 'hartvigs', label: 'Hartvigs', type: 'org',        count: 14 },
  { id: 'mistral',  label: 'Mistral',  type: 'technology', count: 11 },
  { id: 'qdrant',   label: 'Qdrant',   type: 'technology', count: 9  },
  { id: 'sprint',   label: 'Sprint',   type: 'concept',    count: 22 },
  { id: 'roadmap',  label: 'Roadmap',  type: 'concept',    count: 19 },
  { id: 'axum',     label: 'Axum',     type: 'technology', count: 7  },
];

const ENT_EDGES = [
  ['henrik','ombra',0.9], ['sofie','ombra',0.7], ['henrik','sofie',0.6],
  ['ombra','rust',0.8],   ['ombra','flutter',0.7], ['ombra','mistral',0.6],
  ['ombra','qdrant',0.5], ['ombra','axum',0.5],
  ['hartvigs','henrik',0.8], ['hartvigs','sofie',0.4],
  ['sprint','roadmap',0.5], ['henrik','sprint',0.6],
  ['henrik','roadmap',0.5], ['ombra','sprint',0.4],
];

const TYPE_COLORS = {
  person:     '#8B7CF6',
  project:    '#6BA98F',
  technology: '#D4956A',
  org:        '#E57373',
  concept:    '#7BB8D4',
};

function EntityGraph({ tok, dark, width, height }) {
  const canvasRef = React.useRef(null);
  const nodesRef  = React.useRef(null);
  const animRef   = React.useRef(null);
  const [selected, setSelected] = React.useState(null);

  React.useEffect(() => {
    const cx = width / 2, cy = height / 2;
    nodesRef.current = ENT_NODES.map((n, i) => {
      const angle = (i / ENT_NODES.length) * Math.PI * 2;
      const r = Math.min(width, height) * 0.3;
      return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 };
    });

    function tick() {
      const nodes = nodesRef.current;
      const REPEL = 1400, SPRING = 0.04, CENTER = 0.003, DAMP = 0.86;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const d = Math.sqrt(dx*dx + dy*dy) || 1;
          const f = REPEL / (d * d);
          nodes[i].vx -= f*dx/d; nodes[i].vy -= f*dy/d;
          nodes[j].vx += f*dx/d; nodes[j].vy += f*dy/d;
        }
      }
      for (const [a, b, str] of ENT_EDGES) {
        const ni = nodes.find(n => n.id === a), nj = nodes.find(n => n.id === b);
        if (!ni || !nj) continue;
        const dx = nj.x - ni.x, dy = nj.y - ni.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        const target = 80 + (1 - str) * 60;
        const f = (d - target) * SPRING;
        const fx = f*dx/d, fy = f*dy/d;
        ni.vx += fx; ni.vy += fy; nj.vx -= fx; nj.vy -= fy;
      }
      for (const n of nodes) {
        n.vx += (cx - n.x) * CENTER; n.vy += (cy - n.y) * CENTER;
        n.vx *= DAMP; n.vy *= DAMP;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(36, Math.min(width  - 36, n.x));
        n.y = Math.max(36, Math.min(height - 36, n.y));
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      for (const [a, b, str] of ENT_EDGES) {
        const ni = nodes.find(n => n.id === a), nj = nodes.find(n => n.id === b);
        if (!ni || !nj) continue;
        ctx.strokeStyle = tok.accent + Math.round(str * 72).toString(16).padStart(2, '0');
        ctx.lineWidth = str * 2;
        ctx.beginPath(); ctx.moveTo(ni.x, ni.y); ctx.lineTo(nj.x, nj.y); ctx.stroke();
      }

      const selRef = selected; // capture for closure
      for (const n of nodes) {
        const r = 5 + n.count * 0.13;
        const color = TYPE_COLORS[n.type] || tok.textMuted;
        const isSel = selRef === n.id;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color + (isSel ? 'ff' : 'cc');
        ctx.fill();
        if (isSel) {
          ctx.strokeStyle = color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.font = `500 11px "DM Sans", sans-serif`;
        ctx.fillStyle = tok.textSecondary;
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + r + 14);
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height, tok.accent, tok.textSecondary, selected]);

  const handleClick = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    for (const n of nodesRef.current) {
      const r = 5 + n.count * 0.13 + 8;
      if (Math.sqrt((n.x - mx)**2 + (n.y - my)**2) < r) {
        setSelected(s => s === n.id ? null : n.id);
        return;
      }
    }
    setSelected(null);
  };

  const selNode = selected && ENT_NODES.find(n => n.id === selected);

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas ref={canvasRef} width={width} height={height} onClick={handleClick}
        style={{ cursor: 'crosshair', display: 'block' }} />
      {selNode && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: selNode ? tok.surfaceElevated : 'transparent',
          border: `1px solid ${tok.border}`,
          borderRadius: 12, padding: '14px 16px', minWidth: 180,
          boxShadow: tok.shadow2,
        }}>
          <div style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: 20, color: tok.textPrimary, marginBottom: 10 }}>{selNode.label}</div>
          <KVRow tok={tok} label="Type"       value={selNode.type}            color={TYPE_COLORS[selNode.type]} />
          <KVRow tok={tok} label="Encounters" value={String(selNode.count)} />
        </div>
      )}
    </div>
  );
}

const ENT_LAST_SEEN = [2, 2, 0, 24, 36, 72, 48, 60, 4, 6, 96];

function EntitiesContent({ tok, dark }) {
  const [view, setView] = React.useState('graph');
  const containerRef    = React.useRef(null);
  const [dims, setDims] = React.useState({ w: 800, h: 500 });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setDims({ w, h: Math.max(400, Math.round(w * 0.52)) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['graph','table'].map(v => (
            <Chip key={v} label={v} active={view === v} onClick={() => setView(v)} tok={tok} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph / Table container */}
      <div ref={containerRef} style={{
        background: tok.surface, border: `1px solid ${tok.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        {view === 'graph' ? (
          <EntityGraph tok={tok} dark={dark} width={dims.w} height={dims.h} />
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 110px', padding: '11px 20px', borderBottom: `1px solid ${tok.border}` }}>
              {['Name','Type','Count','Last seen'].map(h => (
                <div key={h} style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: tok.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {[...ENT_NODES].sort((a, b) => b.count - a.count).map((n, i) => (
              <div key={n.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 110px', padding: '11px 20px', borderBottom: `1px solid ${tok.borderSubtle}` }}>
                <div style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textPrimary }}>{n.label}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: TYPE_COLORS[n.type] }}>{n.type}</div>
                <div style={{ fontFamily: MONO, fontSize: 13, color: tok.textPrimary }}>{n.count}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>{ENT_LAST_SEEN[i]}h ago</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { EntitiesContent, EntityGraph, TYPE_COLORS, ENT_NODES, ENT_EDGES });
