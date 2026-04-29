// Ombra Admin — Hardware Monitor

const CORE_USAGE = [67, 41, 82, 55];

function ProgressBar({ value, max, tok, color, height = 8 }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height, background: tok.borderSubtle, borderRadius: height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color || tok.accent, borderRadius: height }} />
    </div>
  );
}

function TempValue({ temp, tok }) {
  const color = temp >= 85 ? tok.recording : temp >= 70 ? tok.warning : tok.success;
  return <span style={{ fontFamily: MONO, fontSize: 13, color, fontWeight: 500 }}>{temp}°C</span>;
}

function HardwareContent({ tok }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* CPU + RAM */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* CPU */}
        <Panel tok={tok} title="CPU" style={{ flex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textMuted }}>Raspberry Pi 4B · Cortex-A72 · 4 cores</div>
            <div style={{ fontFamily: MONO, fontSize: 22, color: tok.textPrimary }}>57%</div>
          </div>
          <ProgressBar value={57} max={100} tok={tok} color={tok.accent} height={6} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6, marginTop: 16 }}>
            {CORE_USAGE.map((c, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <div style={{ width: '100%', height: 40, background: tok.surface, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${c}%`, background: tok.accent, opacity: 0.75 }} />
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: tok.textMuted }}>{c}%</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* RAM */}
        <Panel tok={tok} title="RAM" style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textMuted }}>of 8 GB — 72%</div>
            <div style={{ fontFamily: MONO, fontSize: 22, color: tok.textPrimary }}>5.8 GB</div>
          </div>
          <ProgressBar value={5.8} max={8} tok={tok} color={tok.accent} height={8} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <KVRow tok={tok} label="Used"      value="5.8 GB" color={tok.accent} />
            <KVRow tok={tok} label="Available" value="2.2 GB" color={tok.success} />
            <KVRow tok={tok} label="Swap"      value="128 MB" color={tok.textMuted} />
          </div>
        </Panel>
      </div>

      {/* Temps + Disk + Process */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Temperatures */}
        <Panel tok={tok} title="Temperatures" style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              { label: 'CPU package', temp: 62 },
              { label: 'Core 0',      temp: 61 },
              { label: 'Core 1',      temp: 64 },
              { label: 'Core 2',      temp: 60 },
              { label: 'Core 3',      temp: 66 },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 11, borderBottom: `1px solid ${tok.borderSubtle}` }}>
                <span style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textSecondary }}>{r.label}</span>
                <TempValue temp={r.temp} tok={tok} />
              </div>
            ))}
          </div>
        </Panel>

        {/* Disk */}
        <Panel tok={tok} title="Disk" style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { mount: '/',      device: 'mmcblk0p2', used: 14,  total: 32,   fs: 'ext4' },
              { mount: '/data',  device: 'sda1',       used: 312, total: 1000, fs: 'ext4' },
            ].map(d => (
              <div key={d.mount}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: tok.accent }}>{d.mount}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>{d.used} / {d.total} GB</span>
                </div>
                <ProgressBar value={d.used} max={d.total} tok={tok}
                  color={d.used/d.total > 0.8 ? tok.warning : tok.accent} height={5} />
                <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textMuted, marginTop: 4 }}>{d.device} · {d.fs}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Process + Network */}
        <Panel tok={tok} title="Ombra process" style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <KVRow tok={tok} label="RAM"     value="2.1 GB"       color={tok.accent} />
            <KVRow tok={tok} label="CPU"     value="11.4%" />
            <KVRow tok={tok} label="Uptime"  value="14d 6h"       color={tok.success} />
            <KVRow tok={tok} label="Profile" value="Efficiency" />
            <KVRow tok={tok} label="Model"   value="Gemma-2-2B Q4_K_M" />
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: tok.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Network</div>
          {[
            { iface: 'eth0', ip: '192.168.1.42', recv: '1.2 GB', sent: '340 MB' },
            { iface: 'wlan0', ip: '—',            recv: '0 B',    sent: '0 B'    },
          ].map(n => (
            <div key={n.iface} style={{ background: tok.canvas, borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: tok.accent }}>{n.iface}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>{n.ip}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textMuted }}>↓ {n.recv} · ↑ {n.sent}</div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

Object.assign(window, { HardwareContent, ProgressBar });
