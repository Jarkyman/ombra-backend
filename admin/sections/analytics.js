const { useState, useEffect, useRef, useMemo } = React;

// ─── helpers ──────────────────────────────────────────────────────────────────

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtBytes(b) { return b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/(1024*1024)).toFixed(1)} MB`; }
function fmtNum(n)   { return n >= 10000 ? `${(n/1000).toFixed(1)}k` : n.toLocaleString(); }

// ─── format API daily data into chart bars ────────────────────────────────────

function formatBars(days, range) {
  if (!days || !days.length) return [];

  const addLabel = (day) => {
    const dt = new Date(`${day.date}T12:00:00`);
    return { ...day, label: `${dt.getMonth()+1}/${dt.getDate()}`, avg_relevance: day.avg_relevance || 0 };
  };

  if (range === '1d' || range === '7d' || range === '30d') {
    return days.map(addLabel);
  }

  // 1y and all: aggregate into weekly groups
  const grouped = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const clusters     = chunk.reduce((s, d) => s + d.clusters, 0);
    const new_entities = chunk.reduce((s, d) => s + d.new_entities, 0);
    const active       = chunk.filter(d => d.avg_relevance && d.clusters > 0);
    const avg_relevance = active.length
      ? active.reduce((s, d) => s + d.avg_relevance, 0) / active.length
      : 0;
    const dt = new Date(`${chunk[0].date}T12:00:00`);
    grouped.push({ date: chunk[0].date, label: `${dt.getMonth()+1}/${dt.getDate()}`, clusters, new_entities, avg_relevance });
  }
  return grouped;
}

// ─── constants ────────────────────────────────────────────────────────────────

const EVENT_PALETTE = ['#8B7CF6','#D4956A','#6BA98F','#E57373','#7BA8C4','#A09A94'];
const ENTITY_COLOR  = { person:'#8B7CF6', project:'#D4956A', place:'#6BA98F', topic:'#A09A94' };

const RANGE_LABEL = {
  '1d':  '24h window · daily bars',
  '7d':  '7 days · daily bars',
  '30d': '30 days · daily bars',
  '1y':  '1 year · weekly bars',
  'all': 'all time · weekly bars',
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ x, y, lines, tok }) {
  const flip = x > window.innerWidth * 0.65;
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', zIndex: 9999, pointerEvents: 'none',
      left:  flip ? 'auto' : x + 14,
      right: flip ? window.innerWidth - x + 14 : 'auto',
      top: Math.min(y - 10, window.innerHeight - 120),
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 10, padding: '8px 12px', boxShadow: tok.shadow2,
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120,
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {l.dot && <div style={{ width: 6, height: 6, borderRadius: 2, background: l.dot, flexShrink: 0 }} />}
          <span style={{ fontFamily: l.mono ? MONO : SANS, fontSize: l.large ? 13 : 10.5, color: l.muted ? tok.textMuted : tok.textPrimary, fontWeight: l.bold ? 600 : 400 }}>
            {l.text}
          </span>
        </div>
      ))}
    </div>,
    document.body
  );
}

// ─── shared UI ────────────────────────────────────────────────────────────────

function EmptyChart({ tok, message }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:100 }}>
      <span style={{ fontFamily:MONO, fontSize:11, color:tok.textDisabled, letterSpacing:0.4 }}>{message}</span>
    </div>
  );
}

function RangePicker({ value, onChange, tok }) {
  const RANGES = [['1d','1d'],['7d','7d'],['30d','30d'],['1y','1 year'],['all','All']];
  return (
    <div style={{ display:'flex', gap:2, background:tok.surface, border:`1px solid ${tok.border}`, borderRadius:10, padding:3 }}>
      {RANGES.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)} style={{
          fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:0.6,
          padding:'5px 10px', borderRadius:8, border:'none', cursor:'pointer', outline:'none',
          background: value === key ? tok.accentLight : 'transparent',
          color:      value === key ? tok.accent      : tok.textMuted,
          transition:'background 100ms, color 100ms',
        }}>{label}</button>
      ))}
    </div>
  );
}

function StatCard({ tok, label, value, sub, muted }) {
  return (
    <div style={{ flex:'1 1 130px', background:tok.surfaceElevated, border:`1px solid ${tok.border}`, borderRadius:16, padding:'16px 18px', boxShadow:tok.shadow1 }}>
      <div style={{ fontFamily:MONO, fontSize:22, fontWeight:500, color: muted ? tok.textSecondary : tok.textPrimary, letterSpacing:-0.5, lineHeight:1 }}>{value}</div>
      <div style={{ fontFamily:SANS, fontSize:12, color:tok.textSecondary, marginTop:6 }}>{label}</div>
      {sub && <div style={{ fontFamily:MONO, fontSize:9.5, color:tok.textMuted, marginTop:3, letterSpacing:0.2 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ tok, title, children, style = {} }) {
  return (
    <div style={{ background:tok.surfaceElevated, border:`1px solid ${tok.border}`, borderRadius:18, padding:'20px 22px', boxShadow:tok.shadow1, display:'flex', flexDirection:'column', gap:14, minWidth:0, overflow:'hidden', ...style }}>
      <div style={{ fontFamily:SANS, fontSize:10.5, fontWeight:600, color:tok.textMuted, letterSpacing:0.8, textTransform:'uppercase' }}>{title}</div>
      {children}
    </div>
  );
}

// ─── ActivityHeatmap ──────────────────────────────────────────────────────────

function ActivityHeatmap({ tok, days }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const layoutRef    = useRef({});

  const countByDate = useMemo(() => { const m = {}; days.forEach(d => { m[d.date] = d.clusters; }); return m; }, [days]);
  const maxCount    = useMemo(() => Math.max(...days.map(d => d.clusters), 1), [days]);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const W   = container.clientWidth;
      const GAP = 2, CELL = Math.max(8, Math.min(14, Math.floor((W - 32) / 54)));
      const OUT = CELL + GAP, TOP = 22, LEFT = 28, H = TOP + 7 * OUT + 4;

      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);

      const today = new Date();
      const start = new Date(today); start.setDate(start.getDate() - 364); start.setDate(start.getDate() - start.getDay());
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      let prevMonth = -1, col = 0;
      const cur = new Date(start);
      const cells = [];

      while (cur <= today) {
        const x = LEFT + col * OUT;
        for (let row = 0; row < 7; row++) {
          const d = new Date(cur); d.setDate(d.getDate() + row);
          if (d > today) break;
          const dateStr = localDateStr(d);
          const count = countByDate[dateStr] || 0;
          const alpha = count === 0 ? 0 : 0.12 + Math.min(count / maxCount, 1) * 0.88;
          ctx.fillStyle = count === 0 ? tok.surface : `rgba(139,124,246,${alpha.toFixed(2)})`;
          ctx.beginPath(); ctx.roundRect(x, TOP + row * OUT, CELL, CELL, 2); ctx.fill();
          cells.push({ x, y: TOP + row * OUT, w: CELL, h: CELL, dateStr, count });
          if (row === 0 && d.getMonth() !== prevMonth) {
            prevMonth = d.getMonth();
            ctx.fillStyle = tok.textMuted; ctx.font = `500 9px ${MONO}`; ctx.textAlign = 'left';
            ctx.fillText(MONTHS[d.getMonth()], x, TOP - 6);
          }
        }
        col++; cur.setDate(cur.getDate() + 7);
      }
      ['','Mon','','Wed','','Fri',''].forEach((label, i) => {
        if (!label) return;
        ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${MONO}`; ctx.textAlign = 'right';
        ctx.fillText(label, LEFT - 4, TOP + i * OUT + CELL - 2);
      });

      layoutRef.current = { cells, CELL, OUT, TOP, LEFT };
    };

    render();
    const ro = new ResizeObserver(render); ro.observe(container);
    return () => ro.disconnect();
  }, [countByDate, maxCount, tok]);

  const [tooltip, setTooltip] = useState(null);
  const onMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const { cells } = layoutRef.current;
    if (!cells) return;
    const hit = cells.find(c => mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h);
    if (hit) {
      setTooltip({ x: e.clientX, y: e.clientY, date: hit.dateStr, count: hit.count });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflow: 'hidden' }} onMouseMove={onMouseMove} onMouseLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} style={{ display:'block' }} />
      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y} tok={tok} lines={[
          { text: tooltip.date, mono: true, muted: true },
          { text: `${tooltip.count} cluster${tooltip.count !== 1 ? 's' : ''}`, mono: true, bold: true, large: true },
        ]} />
      )}
    </div>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────

function BarChart({ bars, tok }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const layoutRef    = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = container.clientWidth, H = 160;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);

      const PL = 32, PR = 8, PT = 8, PB = 28;
      const CW = W - PL - PR, CH = H - PT - PB;
      const maxC = Math.max(...bars.map(b => b.clusters), 1);
      const gap  = Math.max(1, CW / bars.length * 0.18);
      const barW = CW / bars.length - gap;

      [0.25,0.5,0.75,1].forEach(t => {
        const y = PT + CH * (1-t);
        ctx.strokeStyle = tok.border; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(W-PR,y); ctx.stroke();
        ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${MONO}`; ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxC*t), PL-4, y+3);
      });

      const every = bars.length <= 12 ? 1 : bars.length <= 30 ? 3 : 7;
      const rects = [];
      bars.forEach((b, i) => {
        const x  = PL + i*(barW+gap) + gap/2;
        const bH = Math.max((b.clusters/maxC)*CH, b.clusters > 0 ? 2 : 0);
        const y  = PT + CH - bH;
        ctx.fillStyle = tok.accent; ctx.globalAlpha = 0.82;
        ctx.beginPath(); ctx.roundRect(x, y, Math.max(barW,1), bH, [3,3,0,0]); ctx.fill();
        ctx.globalAlpha = 1;
        if (i % every === 0 || i === bars.length - 1) {
          ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${MONO}`; ctx.textAlign = 'center';
          ctx.fillText(b.label, x + barW/2, H-PB+14);
        }
        rects.push({ x, y: PT, w: Math.max(barW,1), h: CH, bar: b });
      });
      layoutRef.current = { rects, PL, PR, PT, PB, CW, CH, maxC };
    };

    render();
    const ro = new ResizeObserver(render); ro.observe(container);
    return () => ro.disconnect();
  }, [bars, tok]);

  const [tooltip, setTooltip] = useState(null);
  const onMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const { rects } = layoutRef.current;
    if (!rects) return;
    const hit = rects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
    if (hit) {
      setTooltip({ x: e.clientX, y: e.clientY, bar: hit.bar });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflow: 'hidden' }} onMouseMove={onMouseMove} onMouseLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} style={{ display:'block' }} />
      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y} tok={tok} lines={[
          { text: tooltip.bar.label, mono: true, muted: true },
          { text: `${tooltip.bar.clusters} clusters`, mono: true, bold: true, large: true },
          { text: `${tooltip.bar.new_entities} new entities`, mono: true, muted: true },
          ...(tooltip.bar.avg_relevance > 0 ? [{ text: `relevance ${tooltip.bar.avg_relevance.toFixed(2)}`, mono: true, muted: true }] : []),
        ]} />
      )}
    </div>
  );
}

// ─── RelevanceHistogram ───────────────────────────────────────────────────────

function RelevanceHistogram({ bars, tok }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const layoutRef    = useRef([]);

  const buckets = useMemo(() => {
    const b = Array(10).fill(0);
    bars.filter(bar => bar.clusters > 0 && bar.avg_relevance > 0).forEach(bar => {
      b[Math.min(Math.floor(bar.avg_relevance * 10), 9)] += bar.clusters;
    });
    return b;
  }, [bars]);

  const hasData = buckets.some(v => v > 0);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = container.clientWidth, H = 130;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);

      const PL = 32, PR = 8, PT = 8, PB = 28;
      const CW = W-PL-PR, CH = H-PT-PB;
      const maxB = Math.max(...buckets, 1);
      const slotW = CW/10, gap = 3;
      const bucketColor = i => i < 2 ? tok.recording : i < 4 ? tok.warning : i < 7 ? tok.accent : tok.success;

      [0.5,1].forEach(t => {
        const y = PT + CH*(1-t);
        ctx.strokeStyle = tok.border; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(W-PR,y); ctx.stroke();
        if (hasData) {
          ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${MONO}`; ctx.textAlign = 'right';
          ctx.fillText(Math.round(maxB*t), PL-4, y+3);
        }
      });

      buckets.forEach((count, i) => {
        const x  = PL + i*slotW + gap/2;
        const bH = hasData ? Math.max((count/maxB)*CH, count > 0 ? 2 : 0) : 0;
        if (bH > 0) {
          ctx.fillStyle = bucketColor(i); ctx.globalAlpha = 0.82;
          ctx.beginPath(); ctx.roundRect(x, PT+CH-bH, slotW-gap, bH, [3,3,0,0]); ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (i % 2 === 0) {
          ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${MONO}`; ctx.textAlign = 'center';
          ctx.fillText(`${(i*0.1).toFixed(1)}`, x+(slotW-gap)/2, H-PB+14);
        }
      });
      ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${MONO}`; ctx.textAlign = 'center';
      ctx.fillText('1.0', PL+10*slotW-gap/2, H-PB+14);

      if (!hasData) {
        ctx.fillStyle = tok.textDisabled; ctx.font = `400 11px ${MONO}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('no data in this range', W/2, PT + CH/2);
        ctx.textBaseline = 'alphabetic';
      }

      layoutRef.current = { PL, slotW, PT, CH };
    };

    render();
    const ro = new ResizeObserver(render); ro.observe(container);
    return () => ro.disconnect();
  }, [buckets, hasData, tok]);

  const [tooltip, setTooltip] = useState(null);
  const onMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const { PL, slotW, PT, CH } = layoutRef.current;
    if (!slotW || mx < PL || my < PT || my > PT + CH) { setTooltip(null); return; }
    const idx = Math.min(Math.floor((mx - PL) / slotW), 9);
    if (idx < 0) { setTooltip(null); return; }
    setTooltip({ x: e.clientX, y: e.clientY, count: buckets[idx], rangeStart: (idx * 0.1).toFixed(1), rangeEnd: ((idx + 1) * 0.1).toFixed(1) });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflow: 'hidden' }} onMouseMove={onMouseMove} onMouseLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} style={{ display:'block' }} />
      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y} tok={tok} lines={[
          { text: `${tooltip.rangeStart} – ${tooltip.rangeEnd}`, mono: true, muted: true },
          { text: `${tooltip.count} clusters`, mono: true, bold: true, large: true },
        ]} />
      )}
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

function DonutChart({ data, tok }) {
  const canvasRef = useRef(null);
  const SIZE = 140;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE*dpr; canvas.height = SIZE*dpr;
    canvas.style.width = `${SIZE}px`; canvas.style.height = `${SIZE}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, SIZE, SIZE);

    const total = data.reduce((s,d) => s+d.count, 0);
    if (!total) return;

    const cx = SIZE/2, cy = SIZE/2, outerR = SIZE/2-6, innerR = outerR*0.58;
    let angle = -Math.PI/2;
    data.forEach((d, i) => {
      const slice = (d.count/total)*2*Math.PI;
      ctx.beginPath();
      ctx.arc(cx,cy,outerR,angle,angle+slice);
      ctx.arc(cx,cy,innerR,angle+slice,angle,true);
      ctx.closePath();
      ctx.fillStyle = EVENT_PALETTE[i % EVENT_PALETTE.length];
      ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      angle += slice;
    });

    ctx.fillStyle = tok.textPrimary; ctx.font = `500 15px ${MONO}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(total.toLocaleString(), cx, cy-5);
    ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${SANS}`;
    ctx.fillText('clusters', cx, cy+9);
    ctx.textBaseline = 'alphabetic';
  }, [data, tok]);

  if (!data.length) return <EmptyChart tok={tok} message="no clusters yet" />;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
      <canvas ref={canvasRef} style={{ display:'block', flexShrink:0 }} />
      <div style={{ flex:1, minWidth:140, display:'flex', flexDirection:'column', gap:8 }}>
        {data.map((d, i) => (
          <div key={d.event_type} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:2, flexShrink:0, background:EVENT_PALETTE[i%EVENT_PALETTE.length], opacity:0.9 }} />
            <span style={{ fontFamily:SANS, fontSize:12, color:tok.textSecondary, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.event_type}</span>
            <span style={{ fontFamily:MONO, fontSize:10, color:tok.textMuted, flexShrink:0 }}>{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LanguageBars ─────────────────────────────────────────────────────────────

function LanguageBars({ languages, tok }) {
  if (!languages.length) return <EmptyChart tok={tok} message="no clusters yet" />;
  const max = Math.max(...languages.map(l => l.count), 1);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {languages.map(lang => (
        <div key={lang.language} style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:MONO, fontSize:11, color:tok.textSecondary, width:26, flexShrink:0, textTransform:'uppercase' }}>{lang.language}</div>
          <div style={{ flex:1, height:8, background:tok.surface, borderRadius:4, overflow:'hidden' }}>
            <div style={{ width:`${(lang.count/max)*100}%`, height:'100%', background:tok.accent, borderRadius:4, opacity:0.8 }} />
          </div>
          <div style={{ fontFamily:MONO, fontSize:11, color:tok.textMuted, width:42, textAlign:'right', flexShrink:0 }}>{lang.percentage}%</div>
        </div>
      ))}
    </div>
  );
}

// ─── EntityGrowthChart ────────────────────────────────────────────────────────

function EntityGrowthChart({ bars, tok }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const layoutRef    = useRef([]);

  const growthData = useMemo(() => {
    let total = 0;
    return bars.map(b => { total += b.new_entities; return { label:b.label, total }; });
  }, [bars]);

  const hasGrowth = growthData.length > 0 && growthData[growthData.length-1]?.total > 0;

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = container.clientWidth, H = 140;
      canvas.width = W*dpr; canvas.height = H*dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);

      const PL=36, PR=8, PT=8, PB=24;
      const CW=W-PL-PR, CH=H-PT-PB;

      [0.5,1].forEach(t => {
        const y = PT+CH*(1-t);
        ctx.strokeStyle = tok.border; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(W-PR,y); ctx.stroke();
      });

      if (!hasGrowth || growthData.length < 2) {
        ctx.fillStyle = tok.textDisabled; ctx.font = `400 11px ${MONO}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('no new entities in this range', W/2, PT+CH/2);
        ctx.textBaseline = 'alphabetic';
        layoutRef.current = [];
        return;
      }

      const maxVal = Math.max(...growthData.map(d => d.total), 1);
      [0.5,1].forEach(t => {
        const y = PT+CH*(1-t);
        ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${MONO}`; ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxVal*t), PL-4, y+3);
      });

      const pts = growthData.map((d,i) => ({ x: PL+(i/(growthData.length-1))*CW, y: PT+CH*(1-d.total/maxVal), data: d }));

      const grad = ctx.createLinearGradient(0,PT,0,PT+CH);
      grad.addColorStop(0,'rgba(139,124,246,0.22)'); grad.addColorStop(1,'rgba(139,124,246,0)');
      ctx.beginPath(); ctx.moveTo(pts[0].x,PT+CH);
      pts.forEach(p => ctx.lineTo(p.x,p.y));
      ctx.lineTo(pts[pts.length-1].x,PT+CH); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();

      ctx.beginPath();
      pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
      ctx.strokeStyle = tok.accent; ctx.lineWidth = 2; ctx.stroke();

      const every = Math.max(1, Math.floor(growthData.length/4));
      growthData.forEach((d,i) => {
        if (i%every!==0 && i!==growthData.length-1) return;
        const isLast = i === growthData.length - 1;
        ctx.fillStyle = tok.textMuted; ctx.font = `400 9px ${MONO}`;
        ctx.textAlign = isLast ? 'right' : i === 0 ? 'left' : 'center';
        ctx.fillText(d.label, pts[i].x, H-PB+14);
      });

      layoutRef.current = { pts, PL, CW, PT, CH };
    };

    render();
    const ro = new ResizeObserver(render); ro.observe(container);
    return () => ro.disconnect();
  }, [growthData, hasGrowth, tok]);

  const [tooltip, setTooltip] = useState(null);
  const onMouseMove = (e) => {
    if (!hasGrowth) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const { pts } = layoutRef.current;
    if (!pts || pts.length < 2) return;
    let closest = pts[0], minDist = Math.abs(mx - pts[0].x);
    pts.forEach(p => { const d = Math.abs(mx - p.x); if (d < minDist) { minDist = d; closest = p; } });
    if (minDist < 20) {
      setTooltip({ x: e.clientX, y: e.clientY, data: closest.data });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflow: 'hidden' }} onMouseMove={onMouseMove} onMouseLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} style={{ display:'block' }} />
      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y} tok={tok} lines={[
          { text: tooltip.data.label, mono: true, muted: true },
          { text: `${tooltip.data.total} total entities`, mono: true, bold: true, large: true },
        ]} />
      )}
    </div>
  );
}

// ─── TopEntitiesTable ─────────────────────────────────────────────────────────

function TopEntitiesTable({ entities, tok }) {
  if (!entities.length) return <EmptyChart tok={tok} message="no entities tracked yet" />;
  const maxCount = Math.max(...entities.map(e => e.encounter_count), 1);
  return (
    <div>
      {entities.map((e,i) => {
        const color = ENTITY_COLOR[e.entity_type] || tok.textMuted;
        return (
          <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < entities.length-1 ? `1px solid ${tok.borderSubtle}` : 'none' }}>
            <div style={{ fontFamily:MONO, fontSize:11, color:tok.textDisabled, width:16, textAlign:'right', flexShrink:0 }}>{i+1}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <span style={{ fontFamily:SANS, fontSize:13, fontWeight:500, color:tok.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.name}</span>
                <span style={{ fontFamily:MONO, fontSize:9, color, background:`${color}18`, borderRadius:5, padding:'2px 6px', flexShrink:0 }}>{e.entity_type}</span>
              </div>
              <div style={{ height:3, background:tok.surface, borderRadius:2 }}>
                <div style={{ width:`${(e.encounter_count/maxCount)*100}%`, height:'100%', background:color, borderRadius:2, opacity:0.65 }} />
              </div>
            </div>
            <div style={{ fontFamily:MONO, fontSize:12, color:tok.textSecondary, flexShrink:0 }}>{e.encounter_count}×</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── EncounterDistribution ────────────────────────────────────────────────────

function EncounterDistribution({ buckets, tok }) {
  const [tooltip, setTooltip] = useState(null);
  if (!buckets || !buckets.length) return <EmptyChart tok={tok} message="no entities tracked yet" />;
  const max = Math.max(...buckets.map(b => b.count), 1);
  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-end', height:80 }}>
      {buckets.map(b => (
        <div key={b.bucket} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, cursor:'default' }}
          onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, ...b })}
          onMouseLeave={() => setTooltip(null)}
        >
          <div style={{ fontFamily:MONO, fontSize:11, color:tok.textSecondary }}>{b.count}</div>
          <div style={{ width:'100%', height:`${Math.max((b.count/max)*48, b.count>0?2:0)}px`, background:tok.accent, borderRadius:'4px 4px 0 0', opacity:0.75 }} />
          <div style={{ fontFamily:MONO, fontSize:9, color:tok.textMuted, textAlign:'center', letterSpacing:0.2 }}>{b.bucket}</div>
        </div>
      ))}
      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y} tok={tok} lines={[
          { text: tooltip.bucket + ' encounters', mono: true, muted: true },
          { text: `${tooltip.count} entities`, mono: true, bold: true, large: true },
        ]} />
      )}
    </div>
  );
}

// ─── AnalyticsContent ─────────────────────────────────────────────────────────

function AnalyticsContent({ tok }) {
  const [range,       setRange]       = useState('30d');
  const [overview,    setOverview]    = useState(null);
  const [bars,        setBars]        = useState([]);
  const [heatmapDays, setHeatmapDays] = useState([]);
  const [entityStats, setEntityStats] = useState(null);
  const [languages,   setLanguages]   = useState([]);
  const [eventTypes,  setEventTypes]  = useState([]);
  const [loading,     setLoading]     = useState(true);

  const width    = useWindowWidth();
  const isNarrow = width < 1080;

  useEffect(() => {
    Promise.all([
      fetch('/admin/analytics/overview').then(r => r.json()),
      fetch('/admin/analytics/activity?range=all').then(r => r.json()),
      fetch('/admin/analytics/entities').then(r => r.json()),
      fetch('/admin/analytics/languages').then(r => r.json()),
      fetch('/admin/analytics/event-types').then(r => r.json()),
    ]).then(([ov, allAct, ents, langs, evTypes]) => {
      setOverview(ov);
      setHeatmapDays(allAct.days || []);
      setEntityStats(ents);
      setLanguages(langs.languages || []);
      setEventTypes(evTypes.event_types || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`/admin/analytics/activity?range=${range}`)
      .then(r => r.json())
      .then(data => setBars(formatBars(data.days || [], range)))
      .catch(() => {});
  }, [range]);

  const totalInRange = useMemo(() => bars.reduce((s, b) => s + b.clusters, 0), [bars]);

  const avgRelevance = useMemo(() => {
    const active = bars.filter(b => b.clusters > 0 && b.avg_relevance > 0);
    if (!active.length) return '—';
    const totalC = active.reduce((s, b) => s + b.clusters, 0);
    return (active.reduce((s, b) => s + b.avg_relevance * b.clusters, 0) / totalC).toFixed(2);
  }, [bars]);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:64, fontFamily:SANS, fontSize:13, color:tok.textMuted }}>
        Loading analytics…
      </div>
    );
  }

  const topEntities         = entityStats?.top_entities || [];
  const encounterBuckets    = entityStats?.encounter_distribution || [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <RangePicker value={range} onChange={setRange} tok={tok} />
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
        <StatCard tok={tok} label="Total Transcripts" value={fmtNum(overview?.total_transcripts ?? 0)} sub="all time" muted />
        <StatCard tok={tok} label="Total Entities"    value={overview?.total_entities ?? 0}            sub={`${overview?.entities_with_profile ?? 0} with profile · all time`} muted />
        <StatCard tok={tok} label="Database Size"     value={fmtBytes(overview?.db_size_bytes ?? 0)}   sub="all time" muted />
        <StatCard tok={tok} label="Clusters in range" value={totalInRange.toLocaleString()}             sub={RANGE_LABEL[range]} />
        <StatCard tok={tok} label="Avg Relevance"     value={avgRelevance}                              sub={RANGE_LABEL[range]} />
      </div>

      <ChartCard tok={tok} title="Activity — Last 52 Weeks (independent of range)">
        <ActivityHeatmap tok={tok} days={heatmapDays} />
        <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
          <span style={{ fontFamily:MONO, fontSize:9, color:tok.textMuted }}>Less</span>
          {[0,0.2,0.45,0.7,1.0].map((a,i) => (
            <div key={i} style={{ width:11, height:11, borderRadius:2, background: a===0 ? tok.surface : `rgba(139,124,246,${a})`, border:`1px solid ${tok.borderSubtle}` }} />
          ))}
          <span style={{ fontFamily:MONO, fontSize:9, color:tok.textMuted }}>More</span>
        </div>
      </ChartCard>

      <div style={{ display:'flex', flexDirection: isNarrow ? 'column' : 'row', gap:14 }}>
        <ChartCard tok={tok} title={`Clusters · ${totalInRange.toLocaleString()} total · ${RANGE_LABEL[range]}`} style={{ flex:3 }}>
          {totalInRange === 0
            ? <EmptyChart tok={tok} message="no activity in this range" />
            : <BarChart bars={bars} tok={tok} />}
        </ChartCard>
        <ChartCard tok={tok} title="Relevance Score Distribution" style={{ flex:2 }}>
          <RelevanceHistogram bars={bars} tok={tok} />
          <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
            {[{color:tok.recording,label:'Low 0–0.2'},{color:tok.warning,label:'0.2–0.4'},{color:tok.accent,label:'Relevant 0.4–0.7'},{color:tok.success,label:'High 0.7+'}].map(({color,label}) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:7, height:7, borderRadius:2, background:color, opacity:0.8 }} />
                <span style={{ fontFamily:MONO, fontSize:9, color:tok.textMuted }}>{label}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div style={{ display:'flex', flexDirection: isNarrow ? 'column' : 'row', gap:14 }}>
        <ChartCard tok={tok} title="Event Type Breakdown · all time" style={{ flex:1 }}>
          <DonutChart data={eventTypes} tok={tok} />
        </ChartCard>
        <ChartCard tok={tok} title="Language Distribution · all time" style={{ flex:1 }}>
          <LanguageBars languages={languages} tok={tok} />
        </ChartCard>
      </div>

      <div style={{ display:'flex', flexDirection: isNarrow ? 'column' : 'row', gap:14 }}>
        <ChartCard tok={tok} title="Entity Growth" style={{ flex:3 }}>
          <EntityGrowthChart bars={bars} tok={tok} />
        </ChartCard>
        <ChartCard tok={tok} title="Encounter Distribution · all time" style={{ flex:2 }}>
          <EncounterDistribution buckets={encounterBuckets} tok={tok} />
        </ChartCard>
      </div>

      <ChartCard tok={tok} title="Most Encountered Entities · all time">
        <TopEntitiesTable entities={topEntities} tok={tok} />
      </ChartCard>

    </div>
  );
}

Object.assign(window, { AnalyticsContent });
