const { useState, useEffect, useRef, useMemo } = React;

const TYPE_COLORS = {
  person:  '#8B7CF6',
  place:   '#6BA98F',
  project: '#D4956A',
  topic:   '#A09A94',
};

function formatLastSeen(unixSeconds) {
  if (!unixSeconds) return '—';
  const date = new Date(unixSeconds * 1000);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `Today ${h}:${m}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Force-directed graph ────────────────────────────────────────────────────

function EntityGraph({ tok, selectedId, onSelect }) {
  const containerRef  = useRef(null);
  const canvasRef     = useRef(null);
  const selectedIdRef = useRef(selectedId);
  const tokRef        = useRef(tok);

  useEffect(() => { selectedIdRef.current = selectedId; });
  useEffect(() => { tokRef.current = tok; });

  useEffect(() => {
    let cancelled = false;
    let cleanup   = null;

    fetch('/entities/graph')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!data.nodes || data.nodes.length === 0) return;
        cleanup = initSim(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  function initSim(data) {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return null;

    const dpr = window.devicePixelRatio || 1;
    const W   = () => canvas.width  / dpr;
    const H   = () => canvas.height / dpr;

    function setSize() {
      canvas.width  = container.offsetWidth  * dpr;
      canvas.height = container.offsetHeight * dpr;
      canvas.style.width  = container.offsetWidth  + 'px';
      canvas.style.height = container.offsetHeight + 'px';
    }
    setSize();

    const ctx = canvas.getContext('2d');

    // ── Build simulation state ─────────────────────────────────────────────
    const nodeMap = new Map();
    const nodes   = data.nodes.map(n => {
      const node = {
        ...n,
        x:  (Math.random() - 0.5) * 300,
        y:  (Math.random() - 0.5) * 300,
        vx: 0, vy: 0,
        fx: 0, fy: 0,
        r:  5 + Math.log(n.encounter_count + 1) * 3,
      };
      nodeMap.set(n.id, node);
      return node;
    });

    const edges = data.edges
      .map(e => ({ source: nodeMap.get(e.source), target: nodeMap.get(e.target), strength: e.strength }))
      .filter(e => e.source && e.target);

    // ── Interaction state ──────────────────────────────────────────────────
    let offsetX = 0, offsetY = 0, scale = 1;
    let panning = false, dragNode = null;
    let lastMX  = 0,   lastMY   = 0;
    let hoveredNode = null;

    function toWorld(ex, ey) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (ex - rect.left - W() / 2 - offsetX) / scale,
        y: (ey - rect.top  - H() / 2 - offsetY) / scale,
      };
    }

    function hitTest(ex, ey) {
      const { x, y } = toWorld(ex, ey);
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = n.x - x, dy = n.y - y;
        if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n;
      }
      return null;
    }

    function onMouseDown(e) {
      lastMX = e.clientX; lastMY = e.clientY;
      dragNode = hitTest(e.clientX, e.clientY);
      panning  = !dragNode;
    }

    function onMouseMove(e) {
      const dx = e.clientX - lastMX;
      const dy = e.clientY - lastMY;
      if (panning) { offsetX += dx; offsetY += dy; }
      if (dragNode) {
        const wp  = toWorld(e.clientX, e.clientY);
        dragNode.x = wp.x; dragNode.y = wp.y;
        dragNode.vx = 0;   dragNode.vy = 0;
      }
      lastMX = e.clientX; lastMY = e.clientY;
      hoveredNode = hitTest(e.clientX, e.clientY);
      canvas.style.cursor = hoveredNode
        ? 'pointer'
        : (panning || dragNode ? 'grabbing' : 'grab');
    }

    function onMouseUp(e) {
      if (!dragNode) {
        const hit = hitTest(e.clientX, e.clientY);
        onSelect(hit ? hit : null);
      }
      panning  = false;
      dragNode = null;
      canvas.style.cursor = 'grab';
    }

    function onWheel(e) {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 0.91;
      scale = Math.max(0.15, Math.min(6, scale * f));
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('wheel',     onWheel, { passive: false });

    const ro = new ResizeObserver(setSize);
    ro.observe(container);

    // ── Physics ────────────────────────────────────────────────────────────
    const REPULSION = 4000;
    const SPRING_K  = 0.05;
    const REST_LEN  = 140;
    const DAMPING   = 0.82;
    const GRAVITY   = 0.015;

    function tick() {
      for (const n of nodes) { n.fx = 0; n.fy = 0; }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = Math.max(dx * dx + dy * dy, 1);
          const d  = Math.sqrt(d2);
          const f  = REPULSION / d2;
          const fx = f * dx / d, fy = f * dy / d;
          a.fx -= fx; a.fy -= fy;
          b.fx += fx; b.fy += fy;
        }
      }

      for (const e of edges) {
        const a = e.source, b = e.target;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const f  = SPRING_K * (d - REST_LEN);
        const fx = f * dx / d, fy = f * dy / d;
        a.fx += fx; a.fy += fy;
        b.fx -= fx; b.fy -= fy;
      }

      for (const n of nodes) {
        n.fx -= GRAVITY * n.x;
        n.fy -= GRAVITY * n.y;
      }

      for (const n of nodes) {
        if (n === dragNode) continue;
        n.vx = (n.vx + n.fx) * DAMPING;
        n.vy = (n.vy + n.fy) * DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    // ── Draw ───────────────────────────────────────────────────────────────
    function draw() {
      const w = W(), h = H();
      const tok = tokRef.current;
      const selId = selectedIdRef.current;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.setTransform(
        dpr * scale, 0, 0, dpr * scale,
        dpr * (w / 2 + offsetX),
        dpr * (h / 2 + offsetY),
      );

      // Edges
      for (const e of edges) {
        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(e.target.x, e.target.y);
        ctx.strokeStyle = `rgba(128,120,112,${0.12 + e.strength * 0.35})`;
        ctx.lineWidth   = (0.8 + e.strength * 1.5) / scale;
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const color      = TYPE_COLORS[n.entity_type] || '#A09A94';
        const isSelected = n.id === selId;
        const isHovered  = n === hoveredNode;

        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
          ctx.fillStyle = color + '28';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? color : (isHovered ? color + 'DD' : color + '99');
        ctx.fill();

        if (scale > 0.35) {
          const fs = Math.max(8, 10 / scale);
          ctx.font      = `${fs}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = isSelected ? tok.textPrimary : tok.textMuted;
          ctx.fillText(n.name, n.x, n.y + n.r + fs + 2);
        }
      }
    }

    // ── Loop ───────────────────────────────────────────────────────────────
    let rafId;
    function loop() { tick(); draw(); rafId = requestAnimationFrame(loop); }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup',   onMouseUp);
      canvas.removeEventListener('wheel',     onWheel);
      ro.disconnect();
    };
  }

  const legendTypes = Object.entries(TYPE_COLORS);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div
        ref={containerRef}
        style={{
          flex: 1, position: 'relative', minHeight: 400,
          borderRadius: 16, overflow: 'hidden',
          border: `1px solid ${tok.border}`, background: tok.surface,
          cursor: 'grab',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          display: 'flex', gap: 10, flexWrap: 'wrap',
        }}>
          {legendTypes.map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textMuted, letterSpacing: 0.3 }}>
                {type}
              </span>
            </div>
          ))}
        </div>

        {/* Zoom hint */}
        <div style={{
          position: 'absolute', bottom: 14, right: 14,
          fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled,
          letterSpacing: 0.3,
        }}>
          scroll to zoom · drag to pan
        </div>
      </div>
    </div>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────

function EntityDetailPanel({ entity, tok, onClose, isMobile }) {
  if (!entity) return null;
  const color = TYPE_COLORS[entity.entity_type] || tok.textMuted;

  return (
    <div style={{
      width: isMobile ? '100%' : 320,
      maxHeight: isMobile ? '40vh' : '100%',
      flexShrink: 0,
      background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: 24, boxShadow: tok.shadow2,
      display: 'flex', flexDirection: 'column', gap: 16,
      overflowY: 'auto',
      animation: isMobile ? 'slide-up 250ms ease-out' : 'slide-left 250ms ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, color,
          background: `${color}18`, borderRadius: 6, padding: '4px 10px',
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {entity.entity_type}
        </div>
        <div onClick={onClose} style={{ cursor: 'pointer', fontFamily: SANS, color: tok.textMuted, fontSize: 12 }}>
          Close ✕
        </div>
      </div>

      <div>
        <h2 style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: 28, margin: '0 0 4px 0', color: tok.textPrimary, fontWeight: 300 }}>
          {entity.name}
        </h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>
          Last seen: {formatLastSeen(entity.last_seen)}
        </div>
      </div>

      <div style={{ height: 1, background: tok.borderSubtle, margin: '4px 0' }} />

      <div>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Profile Summary
        </div>
        <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: tok.textPrimary }}>
          {entity.profile_summary || (
            <span style={{ color: tok.textDisabled, fontStyle: 'italic' }}>No summary yet.</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: tok.surface, padding: '12px 16px', borderRadius: 12 }}>
        <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textSecondary }}>Total Encounters</div>
        <div style={{ fontFamily: MONO, fontSize: 16, color: tok.accent }}>{entity.encounter_count}</div>
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

function EntitiesContent({ tok }) {
  const width     = useWindowWidth();
  const isMobile  = width < 768;
  const isStacked = width < 990;

  const [entities,    setEntities]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState(() => localStorage.getItem('ombra_entities_view') || 'list');
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('ombra_entities_search') || '');
  const [selectedId,  setSelectedId]  = useState(() => {
    const saved = localStorage.getItem('ombra_entities_selectedId');
    return saved && saved !== 'null' ? saved : null;
  });

  useEffect(() => {
    fetch('/entities')
      .then(r => r.json())
      .then(data => { setEntities(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => localStorage.setItem('ombra_entities_view',       view),        [view]);
  useEffect(() => localStorage.setItem('ombra_entities_search',     searchQuery), [searchQuery]);
  useEffect(() => localStorage.setItem('ombra_entities_selectedId', selectedId === null ? 'null' : selectedId), [selectedId]);

  const filteredEntities = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return entities;
    return entities.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.entity_type.toLowerCase().includes(q) ||
      (e.profile_summary || '').toLowerCase().includes(q)
    );
  }, [searchQuery, entities]);

  const selectedEntity  = entities.find(e => e.id === selectedId) || null;
  const totalEncounters = entities.reduce((s, e) => s + (e.encounter_count || 0), 0);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: MONO, fontSize: 12, color: tok.textMuted }}>
      loading entities…
    </div>
  );

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setView(id)}
      style={{
        fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
        padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', outline: 'none',
        background: view === id ? tok.accentLight : 'transparent',
        color:      view === id ? tok.accent      : tok.textMuted,
        transition: 'background 100ms, color 100ms',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', animation: 'slide-up 200ms ease' }}>

      {/* Stats strip */}
      <div style={{
        display: 'flex', gap: 20, flexWrap: 'wrap',
        padding: '10px 16px',
        background: tok.surface, border: `1px solid ${tok.border}`,
        borderRadius: 12, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            {entities.length}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            entities
          </div>
        </div>
        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            {totalEncounters.toLocaleString()}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            encounters
          </div>
        </div>
      </div>

      {/* Toolbar: tab switcher + search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', gap: 2,
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 10, padding: 3,
        }}>
          {tabBtn('list',  'LIST')}
          {tabBtn('graph', 'GRAPH')}
        </div>

        {view === 'list' && (
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minWidth: 160 }}>
            <input
              type="text"
              placeholder="search entities…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                fontFamily: MONO, fontSize: 11.5, color: tok.textSecondary,
                background: tok.surface, border: `1px solid ${tok.border}`,
                borderRadius: 9, padding: '7px 14px', outline: 'none',
                flex: 1, width: '100%',
                paddingRight: searchQuery ? 30 : 14,
              }}
            />
            {searchQuery && (
              <div
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 6, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: tok.textMuted, padding: 4,
                }}
              >
                <Icon name="x" size={14} color="currentColor" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flexDirection: isStacked ? 'column' : 'row',
        gap: 20, flex: 1, minHeight: 0, minWidth: 0,
      }}>

        {view === 'list' ? (
          <>
            {/* Table */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: isStacked ? 300 : 0, minWidth: 0 }}>
              <div style={{ background: tok.surfaceElevated, borderRadius: 16, border: `1px solid ${tok.border}`, overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
                <div style={{ minWidth: 500, padding: '10px 0' }}>
                  <div style={{ display: 'flex', padding: '12px 24px', borderBottom: `1px solid ${tok.borderSubtle}`, fontFamily: SANS, fontSize: 11, fontWeight: 600, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <div style={{ flex: 2 }}>Entity Name</div>
                    <div style={{ flex: 1 }}>Type</div>
                    <div style={{ flex: 1 }}>Encounters</div>
                    <div style={{ flex: 1, textAlign: 'right' }}>Last Seen</div>
                  </div>
                  {filteredEntities.length === 0 && (
                    <div style={{ padding: '32px 24px', fontFamily: MONO, fontSize: 12, color: tok.textDisabled, textAlign: 'center' }}>
                      {searchQuery ? 'No matching entities.' : 'No entities yet.'}
                    </div>
                  )}
                  {filteredEntities.map(entity => {
                    const color      = TYPE_COLORS[entity.entity_type] || tok.textMuted;
                    const isSelected = selectedId === entity.id;
                    return (
                      <div
                        key={entity.id}
                        onClick={() => setSelectedId(isSelected ? null : entity.id)}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '14px 24px',
                          borderBottom: `1px solid ${tok.borderSubtle}`,
                          cursor: 'pointer',
                          background: isSelected ? tok.surface : 'transparent',
                          transition: 'background 150ms',
                        }}
                      >
                        <div style={{ flex: 2, fontFamily: SANS, fontSize: 14, fontWeight: 500, color: tok.textPrimary }}>{entity.name}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontFamily: MONO, fontSize: 10, color, background: `${color}18`, borderRadius: 6, padding: '3px 8px' }}>{entity.entity_type}</span>
                        </div>
                        <div style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: tok.textSecondary }}>{entity.encounter_count}</div>
                        <div style={{ flex: 1, textAlign: 'right', fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>{formatLastSeen(entity.last_seen)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedEntity && (
              <EntityDetailPanel
                entity={selectedEntity}
                tok={tok}
                onClose={() => setSelectedId(null)}
                isMobile={isStacked}
              />
            )}
          </>
        ) : (
          <>
            <EntityGraph
              tok={tok}
              selectedId={selectedId}
              onSelect={node => setSelectedId(node ? node.id : null)}
            />
            {selectedEntity && (
              <EntityDetailPanel
                entity={selectedEntity}
                tok={tok}
                onClose={() => setSelectedId(null)}
                isMobile={isStacked}
              />
            )}
          </>
        )}
      </div>

      {/* Footer count — list mode only */}
      {view === 'list' && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3, textAlign: 'center', paddingBottom: 4, flexShrink: 0 }}>
          {filteredEntities.length !== entities.length
            ? `showing ${filteredEntities.length} of ${entities.length} entities`
            : `showing ${filteredEntities.length} entities`}
        </div>
      )}

    </div>
  );
}

Object.assign(window, { EntitiesContent, EntityDetailPanel });
