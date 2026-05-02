// Ombra Admin — Memory Browser

const MOCK_CLUSTERS = [
  { id: 'cl_8f2a3b', type: 'conversation', summary: 'Quarterly roadmap discussion with Henrik and Sofie — alignment on Q3 priorities, backend milestones, and mobile release timeline.',           ts: 'Today 14:32', rel: 0.91, lang: 'da' },
  { id: 'cl_7e1a9c', type: 'reading',      summary: 'Article on distributed systems consensus protocols — Raft vs Paxos comparison, applicability to Qdrant cluster configuration.',                  ts: 'Today 12:18', rel: 0.74, lang: 'en' },
  { id: 'cl_6d0b2f', type: 'task',         summary: 'Sprint planning session covering backend refactor scope — estimated 3 weeks, key files and migration path identified.',                           ts: 'Today 11:05', rel: 0.88, lang: 'da' },
  { id: 'cl_5c9a1e', type: 'ambient',      summary: 'Ambient capture during lunch break in the garden — low semantic density, minimal entities detected.',                                            ts: 'Today 09:44', rel: 0.31, lang: 'da' },
  { id: 'cl_4b8d3a', type: 'reflection',   summary: 'Morning journal entry on deep work strategies — energy management and single-tasking throughout the workday.',                                   ts: 'Today 08:12', rel: 0.67, lang: 'da' },
  { id: 'cl_3a7c0b', type: 'conversation', summary: 'Investor call regarding Series A timeline — preliminary interest expressed, follow-up scheduled for May 14.',                                    ts: 'Yesterday 17:40', rel: 0.95, lang: 'en' },
  { id: 'cl_2f6e8c', type: 'reading',      summary: 'Axum documentation deep-dive — middleware chains, extractors, and WebSocket upgrade handling for ombra-server.',                                ts: 'Yesterday 15:22', rel: 0.82, lang: 'en' },
];

function ClusterCard({ cluster, tok }) {
  const typeColor = EVENT_COLORS[cluster.type] || '#A09A94';
  const relColor  = cluster.rel >= 0.7 ? tok.success : cluster.rel >= 0.5 ? tok.warning : tok.textMuted;

  return (
    <div style={{
      background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
      borderRadius: 14, padding: '15px 18px', boxShadow: tok.shadow1,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: typeColor, background: `${typeColor}18`, borderRadius: 6, padding: '3px 8px', letterSpacing: 0.3 }}>{cluster.type}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted, flex: 1 }}>{cluster.id}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: relColor }}>{cluster.rel.toFixed(2)}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textMuted }}>{cluster.lang}</div>
      </div>
      <div style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 300, fontSize: 16, lineHeight: 1.5, color: tok.textSecondary, marginBottom: 10 }}>{cluster.summary}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>{cluster.ts}</div>
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textSecondary, cursor: 'pointer', padding: '3px 11px', borderRadius: 7, border: `1px solid ${tok.border}` }}>View</div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: tok.recording,     cursor: 'pointer', padding: '3px 11px', borderRadius: 7, border: `1px solid ${tok.recording}30`, background: tok.recordingSubtle }}>Flag</div>
        </div>
      </div>
    </div>
  );
}

function MemoryContent({ tok }) {
  const [activeType, setActiveType] = React.useState(null);
  const filtered = activeType ? MOCK_CLUSTERS.filter(c => c.type === activeType) : MOCK_CLUSTERS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: tok.textMuted }}>1,847 clusters</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(EVENT_COLORS).map(([type, color]) => (
            <div key={type} onClick={() => setActiveType(t => t === type ? null : type)} style={{
              fontFamily: MONO, fontSize: 10, color: activeType === type ? '#fff' : color,
              background: activeType === type ? color : `${color}18`,
              borderRadius: 6, padding: '4px 9px', cursor: 'pointer',
              border: `1px solid ${activeType === type ? color : 'transparent'}`,
              transition: 'all 120ms',
            }}>{type}</div>
          ))}
        </div>
      </div>

      {filtered.map(c => <ClusterCard key={c.id} cluster={c} tok={tok} />)}

      <div style={{ textAlign: 'center', padding: '12px 0', fontFamily: SANS, fontSize: 13, color: tok.accent, cursor: 'pointer' }}>
        Load more
      </div>
    </div>
  );
}

Object.assign(window, { MemoryContent, ClusterCard, MOCK_CLUSTERS });
