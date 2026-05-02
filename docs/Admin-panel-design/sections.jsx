// Ombra Admin — Config, Devices, Profile, Trash, Analytics

/* ── Config ─────────────────────────────────────────────── */
function ConfigContent({ tok }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
      <Panel tok={tok} title="Language & AI">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Response language',          value: 'da — Danish'                    },
            { label: 'Cluster timeout',             value: '45 min'                         },
            { label: 'Entity profile threshold',    value: '25 encounters'                  },
            { label: 'Model',                       value: 'gemma-2-2b-q4_k_m'              },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: `1px solid ${tok.borderSubtle}` }}>
              <span style={{ fontFamily: SANS, fontSize: 14, color: tok.textPrimary }}>{r.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: tok.accent, background: tok.accentSubtle, borderRadius: 8, padding: '4px 12px' }}>{r.value}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel tok={tok} title="DDNS">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: tok.textPrimary }}>ombra-home.duckdns.org</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textMuted, marginTop: 4 }}>Last updated 3 minutes ago</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: tok.success, background: tok.successSubtle, borderRadius: 8, padding: '5px 12px' }}>active</div>
        </div>
      </Panel>

      <Panel tok={tok} title="mTLS Certificates">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'CA certificate',     days: 89, ok: true },
            { label: 'Server certificate', days: 89, ok: true },
          ].map(c => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: `1px solid ${tok.borderSubtle}` }}>
              <span style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textSecondary }}>{c.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: c.ok ? tok.success : tok.warning }}>{c.days} days remaining</span>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: '#fff', background: tok.accent, borderRadius: 10, padding: '10px 24px', cursor: 'pointer' }}>Save changes</div>
      </div>

      {/* Danger zone */}
      <div style={{ background: tok.recordingSubtle, border: `1px solid ${tok.recording}40`, borderRadius: 16, padding: '20px 22px' }}>
        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: tok.recording, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Danger zone</div>
        <div style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
          Factory reset deletes <strong>all clusters, entities, profiles, devices, and configuration</strong>. The server process restarts and returns to the initial setup state. This cannot be undone.
        </div>
        <FactoryResetBlock tok={tok} />
      </div>
    </div>
  );
}

function FactoryResetBlock({ tok }) {
  const [input, setInput] = React.useState('');
  const confirmed = input === 'RESET';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ fontFamily: SANS, fontSize: 13, color: tok.textSecondary }}>Type <span style={{ fontFamily: MONO, color: tok.recording }}>RESET</span> to confirm:</div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="RESET"
        style={{
          fontFamily: MONO, fontSize: 13, padding: '7px 12px',
          borderRadius: 9, border: `1.5px solid ${confirmed ? tok.recording : tok.border}`,
          background: tok.canvas, color: tok.textPrimary,
          outline: 'none', width: 120,
          transition: 'border-color 150ms',
        }}
      />
      <div style={{
        fontFamily: SANS, fontSize: 13, fontWeight: 500,
        padding: '7px 18px', borderRadius: 9, cursor: confirmed ? 'pointer' : 'not-allowed',
        background: confirmed ? tok.recording : tok.surface,
        color: confirmed ? '#fff' : tok.textDisabled,
        border: `1px solid ${confirmed ? tok.recording : tok.border}`,
        transition: 'all 150ms',
      }}>Factory reset</div>
    </div>
  );
}

/* ── Devices ─────────────────────────────────────────────── */
function DevicesContent({ tok }) {
  const DEVICES = [
    { cn: 'ombra-phone-01', first: 'Apr 15, 2026', last: '2 min ago',    status: 'connected' },
    { cn: 'ombra-ear-01',   first: 'Apr 15, 2026', last: '2 min ago',    status: 'connected' },
    { cn: 'ombra-phone-02', first: 'Mar 3, 2026',  last: '12 days ago',  status: 'disconnected' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
      {DEVICES.map(d => {
        const sc = d.status === 'connected' ? tok.success : d.status === 'revoked' ? tok.recording : tok.textMuted;
        return (
          <div key={d.cn} style={{
            background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
            borderRadius: 14, padding: '16px 20px', boxShadow: tok.shadow1,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <Icon name="bluetooth" size={18} color={sc} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 13, color: tok.textPrimary }}>{d.cn}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted, marginTop: 3 }}>First seen {d.first} · Last seen {d.last}</div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: sc, background: `${sc}18`, borderRadius: 6, padding: '3px 9px' }}>{d.status}</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: tok.recording, cursor: 'pointer', padding: '4px 12px', borderRadius: 8, border: `1px solid ${tok.recording}40` }}>Revoke</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Profile ─────────────────────────────────────────────── */
function ProfileContent({ tok }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <Panel tok={tok} title="AI-generated summary">
        <div style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 300, fontSize: 19, lineHeight: 1.65, color: tok.textSecondary }}>
          "A software founder and developer focused on privacy-first personal AI tools. Deep interest in Rust, distributed systems, and ambient intelligence. Works in Danish and English. Values focus, craft, and minimal interruption."
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted, marginTop: 14 }}>Generated Apr 28, 2026 · 14 entities with profile</div>
      </Panel>

      <Panel tok={tok} title="Onboarding answers">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { q: 'What do you mainly use Ombra for?',       a: 'Capturing work conversations, ideas, and meetings for later recall.' },
            { q: 'Your primary language?',                   a: 'Danish, with some English.'                                         },
            { q: 'What should Ombra remember about you?',   a: 'That I am a developer working on a startup. I care about focus and deep work.' },
          ].map(r => (
            <div key={r.q} style={{ paddingBottom: 14, borderBottom: `1px solid ${tok.borderSubtle}` }}>
              <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textMuted, marginBottom: 5 }}>{r.q}</div>
              <div style={{ fontFamily: SANS, fontSize: 14, color: tok.textPrimary }}>{r.a}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ── Trash ───────────────────────────────────────────────── */
function TrashContent({ tok }) {
  const TRASH = [
    { id: 'cl_2b6e0f', summary: 'Ambient capture — TV audio in background, no meaningful context detected.', reason: 'Entropy 0.12 — below threshold. No entities, no semantic value.', ts: 'Apr 27, 16:40', rel: 0.12 },
    { id: 'cl_1a5d9e', summary: 'Background noise capture — coffee machine and street sounds.', reason: 'Near-zero entropy, no speech detected. Auto-flagged after 48h.', ts: 'Apr 26, 09:14', rel: 0.08 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: tok.recording, cursor: 'pointer', padding: '6px 16px', borderRadius: 8, border: `1px solid ${tok.recording}40` }}>Delete all ({TRASH.length})</div>
      </div>
      {TRASH.map(item => (
        <div key={item.id} style={{ background: tok.surfaceElevated, border: `1px solid ${tok.border}`, borderRadius: 14, padding: '16px 20px', boxShadow: tok.shadow1 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textMuted, background: tok.surface, borderRadius: 6, padding: '3px 7px' }}>{item.id}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: tok.recording }}>{item.rel.toFixed(2)}</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>{item.ts}</div>
          </div>
          <div style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 300, fontSize: 15, lineHeight: 1.5, color: tok.textSecondary, marginBottom: 8 }}>{item.summary}</div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textMuted, fontStyle: 'italic', marginBottom: 14 }}>AI reason: {item.reason}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textSecondary, cursor: 'pointer', padding: '5px 14px', borderRadius: 8, border: `1px solid ${tok.border}` }}>Restore</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: tok.recording, cursor: 'pointer', padding: '5px 14px', borderRadius: 8, border: `1px solid ${tok.recording}40`, background: tok.recordingSubtle }}>Delete</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Analytics ───────────────────────────────────────────── */
/* ── Analytics ───────────────────────────────────────────── */
const RANGE_OPTS = [
  { label: 'All',    bars: 52, xLeft: '2023',     xRight: 'Apr 29', barLabel: 'week (all-time)' },
  { label: '1 year', bars: 52, xLeft: 'May 2025', xRight: 'Apr 29', barLabel: 'week' },
  { label: '30d',    bars: 30, xLeft: 'Apr 1',    xRight: 'Apr 29', barLabel: 'day' },
  { label: '7d',     bars: 28, xLeft: 'Apr 23',   xRight: 'Apr 29', barLabel: '6h' },
  { label: '1d',     bars: 24, xLeft: '00:00',    xRight: '23:00',  barLabel: 'hour' },
];

function AnalyticsContent({ tok, dark }) {
  const [range, setRange]     = React.useState('30d');
  const [hovered, setHovered] = React.useState(null);

  const heatData = React.useMemo(() => Array.from({ length: 52 * 7 }, (_, i) => {
    const v = (i * 7919 + 1234567) % 97;
    return v < 55 ? 0 : Math.floor(((v - 55) / 42) * 12) + 1;
  }), []);

  const currentRange = RANGE_OPTS.find(r => r.label === range) || RANGE_OPTS[2];
  const bars = React.useMemo(() =>
    Array.from({ length: currentRange.bars }, (_, i) => {
      const s = range === 'All' ? i * 6271 + 444 : range === '1 year' ? i * 7919 + 987 :
                range === '30d' ? i * 6271 + 987 : range === '7d' ? i * 4513 + 321 : i * 3217 + 111;
      return Math.floor((s % 20) + 2);
    }),
    [range]
  );
  const maxBar = Math.max(...bars, 1);
  const inactiveColor = dark ? 'rgba(255,255,255,0.1)' : 'rgba(28,25,23,0.07)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {[
          { label: 'DB size',      value: '312 MB' },
          { label: 'Embeddings',   value: '1,847'  },
          { label: 'Clusters/day', value: '18.4',  sub: 'avg over 30 days' },
          { label: 'Entities',     value: '312'    },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: tok.surfaceElevated, border: `1px solid ${tok.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: tok.shadow1 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 24, color: tok.textPrimary }}>{s.value}</div>
            {s.sub && <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted, marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <Panel tok={tok} title="Activity — last 52 weeks">
        <div style={{ position: 'relative', display: 'flex', gap: 3, overflowX: 'auto' }}>
          {Array.from({ length: 52 }, (_, w) => (
            <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Array.from({ length: 7 }, (_, d) => {
                const val = heatData[w * 7 + d];
                const isHov = hovered && hovered.w === w && hovered.d === d;
                return (
                  <div key={d}
                    onMouseEnter={e => setHovered({ w, d, val, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHovered(null)}
                    style={{ width: 11, height: 11, borderRadius: 2, cursor: 'default',
                      background: val === 0 ? inactiveColor : tok.accent,
                      opacity: val === 0 ? 1 : 0.18 + (val / 12) * 0.82,
                      outline: isHov ? `1.5px solid ${tok.accent}` : 'none' }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {hovered && (
          <div style={{ position: 'fixed', left: hovered.x + 12, top: hovered.y - 36,
            background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
            borderRadius: 8, padding: '5px 10px', pointerEvents: 'none',
            fontFamily: MONO, fontSize: 11, color: tok.textPrimary,
            boxShadow: tok.shadow2, zIndex: 999, whiteSpace: 'nowrap' }}>
            {hovered.val === 0 ? 'No clusters' : `${hovered.val} cluster${hovered.val > 1 ? 's' : ''}`}
          </div>
        )}
      </Panel>

      <Panel tok={tok} title="Clusters">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          {RANGE_OPTS.map(r => (
            <Chip key={r.label} label={r.label} active={range === r.label} onClick={() => setRange(r.label)} tok={tok} />
          ))}
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: currentRange.bars > 40 ? 2 : 4, alignItems: 'flex-end', height: 90 }}>
          {bars.map((val, i) => (
            <div key={i}
              onMouseEnter={e => setHovered({ barIdx: i, val, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHovered(null)}
              style={{ flex: 1, height: `${(val / maxBar) * 100}%`, background: tok.accent,
                borderRadius: '2px 2px 0 0',
                opacity: hovered && hovered.barIdx === i ? 1 : 0.72,
                minWidth: 2, cursor: 'default',
                transition: 'opacity 100ms' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: tok.textMuted }}>{currentRange.xLeft}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: tok.textMuted }}>{currentRange.xRight}</span>
        </div>
        {hovered && hovered.barIdx != null && (
          <div style={{ position: 'fixed', left: hovered.x + 12, top: hovered.y - 36,
            background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
            borderRadius: 8, padding: '5px 10px', pointerEvents: 'none',
            fontFamily: MONO, fontSize: 11, color: tok.textPrimary,
            boxShadow: tok.shadow2, zIndex: 999, whiteSpace: 'nowrap' }}>
            {hovered.val} cluster{hovered.val !== 1 ? 's' : ''} · {currentRange.barLabel}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ── Plugins ─────────────────────────────────────────────── */
const OFFICIAL_PLUGINS = [
  { id: 'calendar',  name: 'Calendar',       desc: 'Sync memory clusters to Google or Apple Calendar events.',   version: '1.0.2', installed: true,  color: '#6BA98F' },
  { id: 'notion',    name: 'Notion',         desc: 'Export clusters and entities as pages in a Notion database.', version: '0.9.1', installed: false, color: '#8B7CF6' },
  { id: 'obsidian',  name: 'Obsidian',       desc: 'Write daily memory notes as markdown files into your vault.', version: '1.1.0', installed: true,  color: '#D4956A' },
  { id: 'slack',     name: 'Slack',          desc: 'Capture Slack conversations and surface relevant clusters.',   version: '0.8.0', installed: false, color: '#7BB8D4' },
];

const COMMUNITY_PLUGINS = [
  { id: 'email',    name: 'email-digest',      author: '@sarah_k',   desc: 'Daily email digest of the highest-relevance clusters.',       version: '0.4.1', stars: 124 },
  { id: 'spotify',  name: 'spotify-context',   author: '@alex_dev',  desc: 'Tag clusters with the music playing at time of capture.',     version: '0.2.3', stars:  67 },
  { id: 'raycast',  name: 'raycast-search',    author: '@marcus_b',  desc: 'Search Ombra memory from Raycast with natural language.',     version: '0.6.0', stars: 341 },
  { id: 'webhook',  name: 'webhook-trigger',   author: '@tim_f',     desc: 'Fire a webhook on every new cluster above a relevance threshold.', version: '0.1.2', stars: 48 },
  { id: 'readwise', name: 'readwise-bridge',   author: '@ella_m',    desc: 'Export reading clusters as highlights to Readwise.',          version: '0.3.0', stars: 88 },
  { id: 'telegram', name: 'telegram-bot',      author: '@dev_anna',  desc: 'Query your memory via a private Telegram bot.',               version: '0.5.1', stars: 210 },
];

function PluginCard({ tok, name, desc, version, installed, color, author, stars, official }) {
  const [isInstalled, setInstalled] = React.useState(!!installed);
  return (
    <div style={{ background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
      borderRadius: 14, padding: '16px 18px', boxShadow: tok.shadow1,
      display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color || tok.accentLight,
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 14, fontWeight: 600, color: '#fff',
        opacity: 0.9 }}>{name[0]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: tok.textPrimary }}>{name}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: tok.textMuted }}>{version}</span>
          {author && <span style={{ fontFamily: MONO, fontSize: 10, color: tok.textMuted }}>{author}</span>}
          {stars != null && <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted, marginLeft: 'auto' }}>★ {stars}</span>}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: tok.textSecondary, lineHeight: 1.45 }}>{desc}</div>
      </div>
      <div onClick={() => setInstalled(v => !v)} style={{
        flexShrink: 0, fontFamily: SANS, fontSize: 12.5, fontWeight: 500,
        padding: '6px 16px', borderRadius: 9, cursor: 'pointer',
        background: isInstalled ? tok.surface : tok.accent,
        color: isInstalled ? tok.textSecondary : '#fff',
        border: `1px solid ${isInstalled ? tok.border : tok.accent}`,
        transition: 'all 140ms',
      }}>{isInstalled ? 'Installed' : 'Install'}</div>
    </div>
  );
}

function PluginsContent({ tok, dark }) {
  const [tab, setTab] = React.useState('official');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Chip label="Official" active={tab === 'official'} onClick={() => setTab('official')} tok={tok} />
        <Chip label="Community" active={tab === 'community'} onClick={() => setTab('community')} tok={tok} />
        <div style={{ flex: 1 }} />
        {tab === 'community' && (
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.accent, cursor: 'pointer',
            padding: '5px 14px', borderRadius: 8, border: `1px solid ${tok.accentBorder}`, background: tok.accentLight }}>
            Submit plugin
          </div>
        )}
      </div>

      {tab === 'official' && (
        <div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: tok.textMuted, marginBottom: 14, lineHeight: 1.55 }}>
            Official plugins are maintained by the Ombra team and guaranteed to work with the current server version.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {OFFICIAL_PLUGINS.map(p => <PluginCard key={p.id} tok={tok} official {...p} />)}
          </div>
        </div>
      )}

      {tab === 'community' && (
        <div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: tok.textMuted, marginBottom: 14, lineHeight: 1.55 }}>
            Community plugins are not reviewed by Ombra. Install only plugins you trust. They run on your server with the same permissions as ombra-server.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {COMMUNITY_PLUGINS.map(p => <PluginCard key={p.id} tok={tok} {...p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ConfigContent, DevicesContent, ProfileContent, TrashContent, AnalyticsContent, PluginsContent });
