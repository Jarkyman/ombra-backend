const { useState, useEffect } = React;

// ─── simulation ───────────────────────────────────────────────────────────────

const CPU_CORES   = 8;
const HIST_LEN    = 48;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function drift(v, lo, hi, step) { return clamp(v + (Math.random() - 0.46) * step, lo, hi); }
function pushHist(arr, val) { return [...arr.slice(1), val]; }

function initHw() {
  return {
    cores:      Array.from({ length: CPU_CORES }, () => 5 + Math.random() * 25),
    cpuFreq:    3200,
    cpuTemp:    48 + Math.random() * 6,
    apuTemp:    52 + Math.random() * 8,
    ramUsed:    9.4,
    ramCached:  3.2,
    ramTotal:   32,
    disks: [
      { mount: '/', label: 'System', used: 47.2, total: 120 },
      { mount: '/data', label: 'Data', used: 134.8, total: 400 },
    ],
    netRx:      1.8,
    netTx:      0.4,
    procCpu:    4.2,
    procMem:    284,
    procThreads: 24,
    procPid:    14823,
  };
}

function tickHw(prev) {
  const cores = prev.cores.map(c => drift(c, 1, 97, 14));
  return {
    ...prev,
    cores,
    cpuFreq:   clamp(prev.cpuFreq + (Math.random() - 0.5) * 200, 2400, 4200),
    cpuTemp:   drift(prev.cpuTemp, 36, 84, 2.5),
    apuTemp:   drift(prev.apuTemp, 40, 90, 3),
    ramUsed:   drift(prev.ramUsed, 5, 28, 0.25),
    netRx:     drift(prev.netRx, 0, 14, 1.4),
    netTx:     drift(prev.netTx, 0, 6, 0.7),
    procCpu:   drift(prev.procCpu, 0.3, 22, 1.8),
    procMem:   drift(prev.procMem, 220, 420, 7),
  };
}

function initHist(hw) {
  const avg = hw.cores.reduce((s, c) => s + c, 0) / CPU_CORES;
  return {
    cpuAvg: Array(HIST_LEN).fill(avg),
    netRx:  Array(HIST_LEN).fill(hw.netRx),
    netTx:  Array(HIST_LEN).fill(hw.netTx),
  };
}

// Global mock server state (kører uafhængigt af komponenten)
let mockHw = initHw();
let mockHist = initHist(mockHw);
let mockUptimeSecs = 14 * 86400 + 6 * 3600 + 23 * 60;

setInterval(() => {
  mockUptimeSecs++;
}, 1000);

setInterval(() => {
  mockHw = tickHw(mockHw);
  const avg = mockHw.cores.reduce((s, c) => s + c, 0) / CPU_CORES;
  mockHist = {
    cpuAvg: pushHist(mockHist.cpuAvg, avg),
    netRx:  pushHist(mockHist.netRx,  mockHw.netRx),
    netTx:  pushHist(mockHist.netTx,  mockHw.netTx),
  };
}, 2000);

function formatUptime(secs) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// ─── shared helpers ───────────────────────────────────────────────────────────

function barColor(tok, pct) {
  if (pct > 85) return tok.recording;
  if (pct > 65) return tok.warning;
  return tok.success;
}

function tempColor(tok, t) {
  if (t > 72) return tok.recording;
  if (t > 55) return tok.warning;
  return tok.success;
}

function fmtSpeed(mbps) {
  if (mbps < 1) return `${(mbps * 1024).toFixed(0)} KB/s`;
  return `${mbps.toFixed(1)} MB/s`;
}

function fmtFreq(mhz) {
  return `${(mhz / 1000).toFixed(2)} GHz`;
}

// ─── HwPanel ─────────────────────────────────────────────────────────────────

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

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, width, height, color, filled = false }) {
  if (!data || data.length < 2) return null;
  const VW   = data.length - 1;
  const VH   = 30;
  const padY = VH * 0.08;
  const max  = Math.max(...data, 0.001);
  const pts  = data.map((v, i) => {
    const x = i;
    const y = VH - padY - (v / max) * (VH - padY * 2);
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${VH} ${line} ${VW},${VH}`;
  return (
    <svg
      width={width} height={height}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {filled && <polygon points={area} fill={color} opacity={0.1} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── CoreBar ─────────────────────────────────────────────────────────────────

function CoreBar({ tok, idx, pct }) {
  const color = barColor(tok, pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: tok.textDisabled, width: 38, flexShrink: 0, letterSpacing: 0.3 }}>
        C{String(idx).padStart(2, '0')}
      </div>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: tok.borderSubtle, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 600ms ease' }} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color, width: 28, textAlign: 'right', flexShrink: 0 }}>
        {pct.toFixed(0)}%
      </div>
    </div>
  );
}

// ─── panels ──────────────────────────────────────────────────────────────────

function CpuPanel({ tok, hw, sparkData }) {
  const avg   = hw.cores.reduce((s, c) => s + c, 0) / CPU_CORES;
  const color = barColor(tok, avg);
  return (
    <HwPanel tok={tok} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <HwTitle tok={tok}>CPU — AMD Ryzen 7 8700G</HwTitle>
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0, alignItems: 'stretch' }}>

        {/* Left: big % + sparkline + freq/temp — distributed vertically */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 120 }}>
          <BigMetric tok={tok} value={avg.toFixed(1)} unit="%" color={color} sub="avg utilisation" />
          <Sparkline data={sparkData} width={120} height={36} color={color} filled />
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, marginBottom: 1 }}>FREQ</div>
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: tok.textSecondary }}>{fmtFreq(hw.cpuFreq)}</div>
            </div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, marginBottom: 1 }}>TEMP</div>
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: tempColor(tok, hw.cpuTemp) }}>{hw.cpuTemp.toFixed(0)}°C</div>
            </div>
          </div>
        </div>

        {/* Right: per-core bars distributed to fill height */}
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
  const usedPct  = (hw.ramUsed / hw.ramTotal) * 100;
  const cachePct = (hw.ramCached / hw.ramTotal) * 100;
  const color    = barColor(tok, usedPct);
  return (
    <HwPanel tok={tok} style={{ height: '100%' }}>
      <HwTitle tok={tok}>Memory</HwTitle>
      <BigMetric tok={tok} value={hw.ramUsed.toFixed(1)} unit="GB" color={color} sub={`of ${hw.ramTotal} GB total`} />
      <div style={{ marginTop: 14 }}>
        <div style={{ position: 'relative', height: 8, borderRadius: 4, background: tok.borderSubtle, overflow: 'hidden', marginBottom: 10 }}>
          {/* cached portion */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: `${cachePct}%`, height: '100%', background: tok.accent + '40', borderRadius: 4 }} />
          {/* used portion */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: `${usedPct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 600ms ease' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { label: 'Used',      val: `${hw.ramUsed.toFixed(1)} GB`,                          color: color        },
            { label: 'Cached',    val: `${hw.ramCached.toFixed(1)} GB`,                        color: tok.accent   },
            { label: 'Available', val: `${(hw.ramTotal - hw.ramUsed).toFixed(1)} GB`,           color: tok.textMuted},
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

function NetworkPanel({ tok, hw, hist }) {
  const rxColor = barColor(tok, (hw.netRx / 14) * 100);
  const txColor = tok.accent;
  return (
    <HwPanel tok={tok} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <HwTitle tok={tok}>Network</HwTitle>
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5 }}>↓ RX</div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, color: rxColor, letterSpacing: -0.5, lineHeight: 1 }}>
            {fmtSpeed(hw.netRx)}
          </div>
          <div style={{ flex: 1, minHeight: 24 }}>
            <Sparkline data={hist.netRx} width="100%" height="100%" color={rxColor} filled />
          </div>
        </div>

        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5 }}>↑ TX</div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, color: txColor, letterSpacing: -0.5, lineHeight: 1 }}>
            {fmtSpeed(hw.netTx)}
          </div>
          <div style={{ flex: 1, minHeight: 24 }}>
            <Sparkline data={hist.netTx} width="100%" height="100%" color={txColor} filled />
          </div>
        </div>

      </div>
    </HwPanel>
  );
}

function TempPanel({ tok, hw }) {
  return (
    <HwPanel tok={tok} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <HwTitle tok={tok}>Temperature</HwTitle>
      <div style={{ display: 'flex', gap: 20, flex: 1, alignItems: 'center' }}>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5 }}>CPU</div>
          <BigMetric tok={tok} value={hw.cpuTemp.toFixed(0)} unit="°C" color={tempColor(tok, hw.cpuTemp)} />
          <ProgressBar tok={tok} pct={hw.cpuTemp} color={tempColor(tok, hw.cpuTemp)} height={4} />
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.3 }}>
            max 100°C
          </div>
        </div>

        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5 }}>APU</div>
          <BigMetric tok={tok} value={hw.apuTemp.toFixed(0)} unit="°C" color={tempColor(tok, hw.apuTemp)} />
          <ProgressBar tok={tok} pct={hw.apuTemp} color={tempColor(tok, hw.apuTemp)} height={4} />
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.3 }}>
            max 100°C
          </div>
        </div>

      </div>
    </HwPanel>
  );
}

function ProcessPanel({ tok, hw, uptime }) {
  const cpuColor = barColor(tok, hw.procCpu * 4);
  return (
    <HwPanel tok={tok} style={{ height: '100%' }}>
      <HwTitle tok={tok}>ombra-server</HwTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[
          { label: 'PID',     value: hw.procPid,                         mono: true  },
          { label: 'CPU',     value: `${hw.procCpu.toFixed(1)}%`,         color: cpuColor },
          { label: 'Memory',  value: `${hw.procMem.toFixed(0)} MB`,       mono: true  },
          { label: 'Threads', value: hw.procThreads,                      mono: true  },
          { label: 'Uptime',  value: uptime,                              mono: true  },
        ].map((row, i, arr) => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '5px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${tok.borderSubtle}` : 'none',
          }}>
            <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textMuted }}>{row.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: row.color || tok.textSecondary }}>{row.value}</div>
          </div>
        ))}
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
          const pct   = (disk.used / disk.total) * 100;
          const color = barColor(tok, pct);
          return (
            <div key={disk.mount}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textSecondary, letterSpacing: 0.3 }}>{disk.mount}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textDisabled }}>{disk.label}</div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color }}>
                  {disk.used.toFixed(1)} / {disk.total} GB
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

// ─── HardwareContent ──────────────────────────────────────────────────────────

function HardwareContent({ tok }) {
  const [hw,   setHw]   = useState(mockHw);
  const [hist, setHist] = useState(mockHist);
  const [uptime, setUptime] = useState(() => formatUptime(mockUptimeSecs));

  const width    = useWindowWidth();
  const isMobile = width < 768;

  useEffect(() => {
    const id = setInterval(() => {
      setHw(mockHw);
      setHist(mockHist);
      setUptime(formatUptime(mockUptimeSecs));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cols = isMobile ? '1fr' : 'repeat(3, 1fr)';
  const span2 = isMobile ? {} : { gridColumn: 'span 2' };
  const span3 = isMobile ? {} : { gridColumn: 'span 3' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, animation: 'slide-up 200ms ease' }}>
      <div style={span2}><CpuPanel   tok={tok} hw={hw} sparkData={hist.cpuAvg} /></div>
      <RamPanel     tok={tok} hw={hw} />
      <NetworkPanel tok={tok} hw={hw} hist={hist} />
      <TempPanel    tok={tok} hw={hw} />
      <ProcessPanel tok={tok} hw={hw} uptime={uptime} />
      <div style={span3}><DiskPanel  tok={tok} hw={hw} /></div>
    </div>
  );
}

Object.assign(window, { HardwareContent });
