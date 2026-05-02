const { useState, useMemo, useEffect, useCallback } = React;

const TOPIC_COLORS = {
  work:         '#8B7CF6',
  social:       '#6BA98F',
  family:       '#D4956A',
  health:       '#E57373',
  learning:     '#7CB9D4',
  travel:       '#9B8EC4',
  fitness:      '#82C4A0',
  errands:      '#A09A94',
  home:         '#C4AA82',
  food:         '#D4A96A',
  conversation: '#8B7CF6',
  meeting:      '#D4956A',
  task:         '#A09A94',
  idea:         '#7CB9D4',
};

function topicColor(eventType) {
  return TOPIC_COLORS[eventType] ?? '#A09A94';
}

function relativeTime(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return `${h}h ago`;
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

const PAGE_SIZE = 50;

function MemoryCard({ tok, mem, expanded, onToggle, onFlag, flagging }) {
  const color = topicColor(mem.event_type);

  return (
    <div
      style={{
        background: tok.surface,
        border: `1px solid ${expanded ? tok.accentBorder : tok.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 150ms',
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <div style={{ fontFamily: MONO, fontSize: 9.5, color, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
            {mem.event_type}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled }}>
            {relativeTime(mem.started_at * 1000)}
          </div>
        </div>

        <div style={{
          fontFamily: SANS, fontSize: 13.5, lineHeight: 1.65,
          color: tok.textSecondary,
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 3,
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
          marginBottom: 10,
        }}>
          {mem.event_summary}
        </div>
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px',
          borderTop: `1px solid ${tok.borderSubtle}`,
          background: expanded ? tok.surfaceElevated : 'transparent',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.3 }}>
          {mem.language}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled }}>·</div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled }}>
          {(mem.relevance_score * 100).toFixed(0)}% relevance
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: tok.textDisabled, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
          {mem.id}
        </div>

        <div
          onClick={() => !flagging && onFlag(mem.id)}
          title="Flag for deletion"
          style={{
            cursor: flagging ? 'wait' : 'pointer',
            padding: '2px 4px', borderRadius: 5,
            color: tok.textDisabled,
            opacity: flagging ? 0.5 : 1,
            transition: 'color 120ms',
          }}
        >
          <Icon name="trash" size={13} color={tok.textDisabled} />
        </div>
      </div>
    </div>
  );
}

function MemoryContent({ tok }) {
  const [clusters,    setClusters]    = useState([]);
  const [overview,    setOverview]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [flagging,    setFlagging]    = useState(new Set());

  const [search,       setSearch]       = useState(() => localStorage.getItem('ombra_memory_search') || '');
  const [topicFilter,  setTopicFilter]  = useState(() => localStorage.getItem('ombra_memory_topicFilter') || 'ALL');
  const [sortOrder,    setSortOrder]    = useState(() => localStorage.getItem('ombra_memory_sortOrder') || 'newest');
  const [expandedId,   setExpandedId]   = useState(null);

  const width    = useWindowWidth();
  const isMobile = width < 768;

  useEffect(() => {
    Promise.all([
      fetch(`/clusters?limit=${PAGE_SIZE}&offset=0`).then(r => r.json()),
      fetch('/admin/analytics/overview').then(r => r.json()),
    ]).then(([data, ov]) => {
      setClusters(data);
      setOverview(ov);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    fetch(`/clusters?limit=${PAGE_SIZE}&offset=${clusters.length}`)
      .then(r => r.json())
      .then(data => {
        setClusters(prev => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }, [clusters.length]);

  const handleFlag = useCallback((id) => {
    setFlagging(prev => new Set(prev).add(id));
    fetch(`/clusters/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagged_by: 'admin' }),
    }).then(r => {
      if (r.ok) setClusters(prev => prev.filter(c => c.id !== id));
    }).finally(() => {
      setFlagging(prev => { const s = new Set(prev); s.delete(id); return s; });
    });
  }, []);

  useEffect(() => localStorage.setItem('ombra_memory_search', search), [search]);
  useEffect(() => localStorage.setItem('ombra_memory_topicFilter', topicFilter), [topicFilter]);
  useEffect(() => localStorage.setItem('ombra_memory_sortOrder', sortOrder), [sortOrder]);

  const topics = useMemo(() => [...new Set(clusters.map(c => c.event_type))].sort(), [clusters]);

  const filtered = useMemo(() => {
    let list = clusters;
    if (topicFilter !== 'ALL') list = list.filter(c => c.event_type === topicFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.event_summary.toLowerCase().includes(q) ||
        c.event_type.toLowerCase().includes(q)
      );
    }
    return sortOrder === 'newest'
      ? [...list].sort((a, b) => b.started_at - a.started_at)
      : [...list].sort((a, b) => a.started_at - b.started_at);
  }, [clusters, search, topicFilter, sortOrder]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: MONO, fontSize: 12, color: tok.textMuted }}>
      loading memory…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slide-up 200ms ease' }}>

      {/* Stats strip */}
      <div style={{
        display: 'flex', gap: 20, flexWrap: 'wrap',
        padding: '10px 16px',
        background: tok.surface, border: `1px solid ${tok.border}`,
        borderRadius: 12,
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            {overview ? overview.total_clusters.toLocaleString() : '—'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            clusters
          </div>
        </div>
        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            {overview ? overview.total_entities.toLocaleString() : '—'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            entities
          </div>
        </div>
        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            {clusters.length.toLocaleString()}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            loaded
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="search clusters…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: 11.5, color: tok.textSecondary,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: 9, padding: '7px 14px', outline: 'none',
            flex: 1, minWidth: 160,
          }}
        />

        {!isMobile && topics.length > 0 && (
          <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} style={{
            fontFamily: MONO, fontSize: 11, color: tok.textSecondary,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: 9, padding: '7px 12px', cursor: 'pointer', outline: 'none',
          }}>
            <option value="ALL">all types</option>
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{
          fontFamily: MONO, fontSize: 11, color: tok.textSecondary,
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 9, padding: '7px 12px', cursor: 'pointer', outline: 'none',
        }}>
          <option value="newest">newest first</option>
          <option value="oldest">oldest first</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 200, background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 14,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textDisabled, letterSpacing: 0.5 }}>
            {search || topicFilter !== 'ALL' ? 'no clusters match filter' : 'no clusters yet'}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: 12,
          paddingBottom: 8,
        }}>
          {filtered.map(mem => (
            <MemoryCard
              key={mem.id}
              tok={tok}
              mem={mem}
              expanded={expandedId === mem.id}
              onToggle={() => setExpandedId(id => id === mem.id ? null : mem.id)}
              onFlag={handleFlag}
              flagging={flagging.has(mem.id)}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && filtered.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
              padding: '8px 20px', borderRadius: 9, cursor: loadingMore ? 'wait' : 'pointer',
              border: `1px solid ${tok.border}`, background: tok.surface, color: tok.textMuted,
              opacity: loadingMore ? 0.6 : 1, outline: 'none',
            }}
          >
            {loadingMore ? 'loading…' : 'load more'}
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3, textAlign: 'center', paddingBottom: 4 }}>
        {filtered.length !== clusters.length
          ? `showing ${filtered.length} of ${clusters.length} loaded clusters`
          : `showing ${filtered.length} clusters`}
      </div>

    </div>
  );
}

Object.assign(window, { MemoryContent });
