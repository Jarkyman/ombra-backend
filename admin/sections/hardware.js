const { useState, useEffect, useRef } = React;

const HIST_LEN = 48;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function barColor(tok, pct) {
  if (pct > 85) return tok.recording;
  if (pct > 65) return tok.warning;
  return tok.success;
}

function fmtGHz(mhz) {
  return `${(mhz / 1000).toFixed(2)} GHz`;
}

function fmtGB(bytes) {
  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}

function HwPanel({ tok, children, style = {} }) {
  return (
    <div style={{
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '16px 18px', boxShadow: tok.shadow1,
      ...style,
    }}>
      {children}
    </div>
  );
}

function HwTitle({ tok, children }) {
  return (
    <div style={{
      fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 1.1,
      textTransform: 'uppercase', color: tok.textMuted, marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function BigMetric({ tok, value, unit, color, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 32, fontWeight: 500, letterSpacing: -1, color: color || tok.textPrimary, lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: MONO, fontSize: 12, color: tok.textMuted, letterSpacing: 0.3 }}>{unit}</span>
        )}
      </div>
      {sub && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3 }}>{sub}</div>
      )}
    </div>
  );
}

function ProgressBar({ tok, pct, color, height = 5 }) {
  return (
    <div style={{ width: '100%', height, borderRadius: height, background: tok.borderSubtle, overflow: 'hidden' }}>
      <div style={{
        width: `${clamp(pct, 0, 100)}%`, height: '100%',
        background: color || barColor(tok, pct),
        borderRadius: height, transition: 'width 600ms ease',
      }} />
    </div>
  );
}

function Sparkline({ data, width, height, color }) {
  if (!data || data.length < 2) return null;
  const VW  = data.length - 1;
  const VH  = 30;
  const padY = VH * 0.08;
  const max = Math.max(...data, 0.001);
  const pts = data.map((v, i) => {
    const x = i;
    const y = VH - padY - (v / max) * (VH - padY * 2);
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${VH} ${line} ${VW},${VH}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polygon points={area} fill={color} opacity={0.1} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CoreBar({ tok, idx, pct }) {
  const color = barColor(tok, pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: tok.textDisabled, width: 38, flexShrink: 0, letterSpacing: 0.3 }}>
        C{String(idx).padStart(2, '0')}
      </div>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: tok.borderSubtle, overflow: 'hidden' }}>
        <div style={{ width: `${clamp(pct, 0, 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 600ms ease' }} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color, width: 28, textAlign: 'right', flexShrink: 0 }}>
        {pct.toFixed(0)}%
      </div>
    </div>
  );
}

function CpuPanel({ tok, hw, sparkData }) {
  const avg   = hw.cores.length > 0
    ? hw.cores.reduce((s, c) => s + c, 0) / hw.cores.length
    : 0;
  const color = barColor(tok, avg);
  return (
    <HwPanel tok={tok} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <HwTitle tok={tok}>CPU</HwTitle>
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0, alignItems: 'stretch' }}>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 120 }}>
          <BigMetric tok={tok} value={avg.toFixed(1)} unit="%" color={color} sub="avg utilisation" />
          <Sparkline data={sparkData} width={120} height={36} color={color} />
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, marginBottom: 1 }}>FREQ</div>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: tok.textSecondary }}>{fmtGHz(hw.cpu_freq_mhz)}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', alignContent: 'space-between', gap: '0 20px', minWidth: 200 }}>
          {hw.cores.map((c, i) => (
            <CoreBar key={i} tok={tok} idx={i} pct={c} />
          ))}
        </div>

      </div>
    </HwPanel>
  );
}

function RamPanel({ tok, hw }) {
  const used  = hw.ram_used_bytes;
  const total = hw.ram_total_bytes;
  const pct   = total > 0 ? (used / total) * 100 : 0;
  const color = barColor(tok, pct);
  return (
    <HwPanel tok={tok} style={{ height: '100%' }}>
      <HwTitle tok={tok}>Memory</HwTitle>
      <BigMetric tok={tok} value={fmtGB(used)} color={color} sub={`of ${fmtGB(total)} total`} />
      <div style={{ marginTop: 14 }}>
        <ProgressBar tok={tok} pct={pct} color={color} height={8} />
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { label: 'Used',      val: fmtGB(used),         color },
            { label: 'Available', val: fmtGB(total - used),  color: tok.textMuted },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: SANS, fontSize: 11.5, color: tok.textMuted }}>{row.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: row.color }}>{row.val}</div>
            </div>
          ))}
        </div>
      </div>
    </HwPanel>
  );
}

function DiskPanel({ tok, hw }) {
  return (
    <HwPanel tok={tok}>
      <HwTitle tok={tok}>Disk</HwTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {hw.disks.map(disk => {
          const pct   = disk.total_bytes > 0 ? (disk.used_bytes / disk.total_bytes) * 100 : 0;
          const color = barColor(tok, pct);
          return (
            <div key={disk.mount}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textSecondary, letterSpacing: 0.3 }}>{disk.mount}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textDisabled }}>{disk.label}</div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color }}>
                  {fmtGB(disk.used_bytes)} / {fmtGB(disk.total_bytes)}
                  <span style={{ color: tok.textDisabled, marginLeft: 8 }}>{pct.toFixed(0)}%</span>
                </div>
              </div>
              <ProgressBar tok={tok} pct={pct} color={color} height={6} />
            </div>
          );
        })}
      </div>
    </HwPanel>
  );
}

function HardwareContent({ tok }) {
  const [hw,   setHw]   = useState(null);
  const histRef          = useRef(Array(HIST_LEN).fill(0));

  const width    = useWindowWidth();
  const isMobile = width < 768;

  useEffect(() => {
    const source = new EventSource('/admin/hardware/stream');
    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const avg = data.cores.length > 0
          ? data.cores.reduce((s, c) => s + c, 0) / data.cores.length
          : 0;
        histRef.current = [...histRef.current.slice(1), avg];
        setHw({ ...data, _hist: [...histRef.current] });
      } catch {}
    };
    return () => source.close();
  }, []);

  if (!hw) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: MONO, fontSize: 12, color: tok.textMuted }}>
      loading hardware…
    </div>
  );

  const cols  = isMobile ? '1fr' : 'repeat(3, 1fr)';
  const span2 = isMobile ? {} : { gridColumn: 'span 2' };
  const span3 = isMobile ? {} : { gridColumn: 'span 3' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, animation: 'slide-up 200ms ease' }}>
      <div style={span2}><CpuPanel tok={tok} hw={hw} sparkData={hw._hist} /></div>
      <RamPanel tok={tok} hw={hw} />
      <div style={span3}><DiskPanel tok={tok} hw={hw} /></div>
    </div>
  );
}

Object.assign(window, { HardwareContent });
