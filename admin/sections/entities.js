const { useState, useEffect, useMemo } = React;

const TYPE_COLORS = {
  person: '#8B7CF6',
  place: '#6BA98F',
  project: '#D4956A',
  topic: '#A09A94'
};

function formatLastSeen(unixSeconds) {
  if (!unixSeconds) return '—';
  const date = new Date(unixSeconds * 1000);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `Today ${h}:${m}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

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
      animation: isMobile ? 'slide-up 250ms ease-out' : 'slide-left 250ms ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color, background: `${color}18`, borderRadius: 6, padding: '4px 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {entity.entity_type}
        </div>
        <div onClick={onClose} style={{ cursor: 'pointer', fontFamily: SANS, color: tok.textMuted, fontSize: 12 }}>Close ✕</div>
      </div>

      <div>
        <h2 style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: 28, margin: '0 0 4px 0', color: tok.textPrimary, fontWeight: 300 }}>{entity.name}</h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>Last seen: {formatLastSeen(entity.last_seen)}</div>
      </div>

      <div style={{ height: 1, background: tok.borderSubtle, margin: '4px 0' }} />

      <div>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Profile Summary</div>
        <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: tok.textPrimary }}>
          {entity.profile_summary || <span style={{ color: tok.textDisabled, fontStyle: 'italic' }}>No summary yet.</span>}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: tok.surface, padding: '12px 16px', borderRadius: 12 }}>
        <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textSecondary }}>Total Encounters</div>
        <div style={{ fontFamily: MONO, fontSize: 16, color: tok.accent }}>{entity.encounter_count}</div>
      </div>
    </div>
  );
}

function EntitiesContent({ tok }) {
  const width = useWindowWidth();
  const isMobile = width < 768;
  const isStacked = width < 990;

  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('ombra_entities_searchQuery') || '');
  const [selectedId, setSelectedId] = useState(() => {
    const saved = localStorage.getItem('ombra_entities_selectedId');
    return saved && saved !== 'null' ? saved : null;
  });

  useEffect(() => {
    fetch('/entities')
      .then(r => r.json())
      .then(data => { setEntities(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => localStorage.setItem('ombra_entities_searchQuery', searchQuery), [searchQuery]);
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

  const selectedEntity = entities.find(e => e.id === selectedId);
  const totalEncounters = entities.reduce((s, e) => s + (e.encounter_count || 0), 0);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: MONO, fontSize: 12, color: tok.textMuted }}>
      loading entities…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', animation: 'slide-up 200ms ease' }}>

      {/* Stats strip */}
      <div style={{
        display: 'flex', gap: 20, flexWrap: 'wrap',
        padding: '10px 16px',
        background: tok.surface, border: `1px solid ${tok.border}`,
        borderRadius: 12, flexShrink: 0
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

      {/* Search bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'stretch', flexShrink: 0 }}>
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
              paddingRight: searchQuery ? 30 : 14
            }}
          />
          {searchQuery && (
            <div
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: 6, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: tok.textMuted, padding: 4
              }}
            >
              <Icon name="x" size={14} color="currentColor" />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flexDirection: isStacked ? 'column' : 'row', gap: 20, flex: 1, minHeight: 0, minWidth: 0 }}>

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
                const color = TYPE_COLORS[entity.entity_type] || tok.textMuted;
                const isSelected = selectedId === entity.id;
                return (
                  <div
                    key={entity.id}
                    onClick={() => setSelectedId(isSelected ? null : entity.id)}
                    style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: `1px solid ${tok.borderSubtle}`, cursor: 'pointer', background: isSelected ? tok.surface : 'transparent', transition: 'background 150ms' }}
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

        {/* Detail Panel */}
        {selectedEntity && (
          <EntityDetailPanel
            entity={selectedEntity}
            tok={tok}
            onClose={() => setSelectedId(null)}
            isMobile={isStacked}
          />
        )}

      </div>

      {/* Footer count */}
      <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3, textAlign: 'center', paddingBottom: 4, flexShrink: 0 }}>
        {filteredEntities.length !== entities.length
          ? `showing ${filteredEntities.length} of ${entities.length} entities`
          : `showing ${filteredEntities.length} entities`}
      </div>

    </div>
  );
}

Object.assign(window, { EntitiesContent, EntityDetailPanel });
