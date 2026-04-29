const { useState, useMemo, useEffect } = React;

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_MEMORIES = [
  {
    id: 'clus_8f2a',
    text: 'Book club met at Sarah\'s tonight. Discussing The Three-Body Problem — everyone loved the Dark Forest theory. Sarah suggested Blindsight as the next read. Meetings are moving to Thursday evenings from now on, since Tuesdays clash with Jakob\'s football.',
    created_at: Date.now() - 2 * 60 * 1000,
    source: 'iPhone 15 Pro',
    words: 48,
    vectors: 4,
    entities: ['Sarah Kim', 'Jakob', 'The Three-Body Problem', 'Blindsight'],
    flagged: false,
    topic: 'social',
  },
  {
    id: 'clus_7c3b',
    text: 'Need to pick up: oat milk, sourdough, salmon fillets, arugula, good olive oil. Also the prescription from Matas — they close at 18:00 on Fridays so go before work.',
    created_at: Date.now() - 48 * 60 * 1000,
    source: 'iPhone 15 Pro',
    words: 34,
    vectors: 2,
    entities: ['Matas'],
    flagged: false,
    topic: 'errands',
  },
  {
    id: 'clus_6e1c',
    text: 'Project Lumen kickoff done. Splitting into three tracks: frontend (Jakob), backend (me), design system (Mia). Deadline is end of Q2. I need to update the roadmap doc this week and schedule weekly syncs on Mondays.',
    created_at: Date.now() - 3 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 41,
    vectors: 3,
    entities: ['Jakob', 'Mia', 'Project Lumen'],
    flagged: false,
    topic: 'work',
  },
  {
    id: 'clus_5d8a',
    text: 'Called dad. He\'s visiting Copenhagen in mid-May, probably the 17th or 18th. Need to book a restaurant — he loves Italian. Maybe Brace or Era Ora. Check if Nanna can join too.',
    created_at: Date.now() - 6 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 40,
    vectors: 3,
    entities: ['Dad', 'Nanna', 'Copenhagen', 'Brace', 'Era Ora'],
    flagged: false,
    topic: 'family',
  },
  {
    id: 'clus_4b9d',
    text: 'Flight CPH to LHR on 14 June. Terminal 2, gate opens at 06:30. Booking reference ABCXYZ. Remember European travel adapter and let Airbnb host know early check-in.',
    created_at: Date.now() - 14 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 35,
    vectors: 2,
    entities: ['CPH', 'LHR'],
    flagged: false,
    topic: 'travel',
  },
  {
    id: 'clus_3a2f',
    text: 'Dentist appointment Tuesday 13:30 at Nørreport. Bring insurance card. Ask about the sensitivity in the lower left molar — been bothering me for about two weeks.',
    created_at: Date.now() - 1.2 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 33,
    vectors: 2,
    entities: ['Nørreport'],
    flagged: false,
    topic: 'health',
  },
  {
    id: 'clus_2f7e',
    text: 'Meeting with the investors at 14:00. They want a demo of the memory playback feature specifically. Prepare a clean session recording and have the latency numbers ready — they will ask about inference speed.',
    created_at: Date.now() - 1.8 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 40,
    vectors: 3,
    entities: ['Ombra'],
    flagged: false,
    topic: 'work',
  },
  {
    id: 'clus_1c4b',
    text: 'Podcast recommendation from Mia: "Acquired" — specifically the Nvidia episode. Also she mentioned a Substack called "Lenny\'s Newsletter" for product strategy content.',
    created_at: Date.now() - 2.1 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 31,
    vectors: 2,
    entities: ['Mia', 'Acquired', 'Nvidia', "Lenny's Newsletter"],
    flagged: false,
    topic: 'learning',
  },
  {
    id: 'clus_0e5c',
    text: 'Landlord says the leak in the bathroom is from the upstairs neighbour — maintenance crew coming Thursday between 10 and 14. Work from a café that day. Maybe Prolog or Democratic.',
    created_at: Date.now() - 2.6 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 37,
    vectors: 2,
    entities: ['Prolog', 'Democratic'],
    flagged: true,
    topic: 'home',
  },
  {
    id: 'clus_9d3a',
    text: 'Sleep has been terrible this week. Going to bed too late, phone in bed. Starting a rule: no screens after 22:00, phone on charger in the hallway. Try for two weeks.',
    created_at: Date.now() - 3.2 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 38,
    vectors: 2,
    entities: [],
    flagged: false,
    topic: 'health',
  },
  {
    id: 'clus_8c1e',
    text: 'Sarah Kim mentioned her new role at Stripe — she starts in August. Celebration dinner planned for the last Friday of July. She asked if I could help with her resignation letter.',
    created_at: Date.now() - 4 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 36,
    vectors: 2,
    entities: ['Sarah Kim', 'Stripe'],
    flagged: false,
    topic: 'social',
  },
  {
    id: 'clus_7b2f',
    text: 'Running pace is improving. Hit 5:12 per km on Thursday\'s long run — best since January. Target is sub-5:00 before the half marathon in September. Keep Thursday long runs and add one tempo session.',
    created_at: Date.now() - 5 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 41,
    vectors: 3,
    entities: [],
    flagged: false,
    topic: 'fitness',
  },
  {
    id: 'clus_6a4d',
    text: 'Read about Retrieval-Augmented Generation improvements. The key insight: chunking strategy matters more than embedding model choice for dense retrieval. Sentence-level chunks with 20% overlap outperform fixed-size chunks.',
    created_at: Date.now() - 6 * 24 * 3600 * 1000,
    source: 'MacBook Pro',
    words: 37,
    vectors: 3,
    entities: [],
    flagged: false,
    topic: 'learning',
  },
  {
    id: 'clus_5e8b',
    text: 'Mom\'s birthday is May 31st. Order flowers this week — she loves peonies and ranunculus. Check if dad already has plans or if we\'re doing something together.',
    created_at: Date.now() - 7 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 33,
    vectors: 2,
    entities: ['Mom', 'Dad'],
    flagged: false,
    topic: 'family',
  },
  {
    id: 'clus_4f1c',
    text: 'The Q1 numbers are in. ARR grew 18% but churn ticked up to 4.2% — needs attention. Jakob thinks it\'s the onboarding flow. Mia wants to do user interviews next week.',
    created_at: Date.now() - 8 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 38,
    vectors: 3,
    entities: ['Jakob', 'Mia'],
    flagged: true,
    topic: 'work',
  },
  {
    id: 'clus_3g2a',
    text: 'Tried the new coffee place on Gammel Kongevej — Darcy\'s. Filter coffee was excellent, oat flat white less so. Good spot to work in the mornings, quiet before 10.',
    created_at: Date.now() - 9 * 24 * 3600 * 1000,
    source: 'iPhone 15 Pro',
    words: 34,
    vectors: 2,
    entities: ["Darcy's", 'Gammel Kongevej'],
    flagged: false,
    topic: 'food',
  },
];

const TOPICS = [...new Set(MOCK_MEMORIES.map(m => m.topic))].sort();

const TOPIC_COLORS = {
  work:     '#8B7CF6',
  social:   '#6BA98F',
  family:   '#D4956A',
  health:   '#E57373',
  learning: '#7CB9D4',
  travel:   '#9B8EC4',
  fitness:  '#82C4A0',
  errands:  '#A09A94',
  home:     '#C4AA82',
  food:     '#D4A96A',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m    = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(diff / 86400000);
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return `${h}h ago`;
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

// ─── EntityChip ───────────────────────────────────────────────────────────────

function EntityChip({ tok, label, color }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.3,
      padding: '2px 8px', borderRadius: 100,
      background: color ? `${color}18` : tok.accentSubtle,
      color:      color ?? tok.accent,
      border:     `1px solid ${color ? `${color}30` : tok.accentBorder}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </div>
  );
}

// ─── MemoryCard ───────────────────────────────────────────────────────────────

function MemoryCard({ tok, mem, expanded, onToggle, onFlag }) {
  const topicColor = TOPIC_COLORS[mem.topic] ?? tok.accent;

  return (
    <div
      style={{
        background: tok.surface,
        border: `1px solid ${expanded ? tok.accentBorder : (mem.flagged ? tok.warning + '60' : tok.border)}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 150ms',
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      {/* ── card header ── */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {/* topic dot */}
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: topicColor, flexShrink: 0 }} />
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: topicColor, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
            {mem.topic}
          </div>
          <div style={{ flex: 1 }} />
          {mem.flagged && (
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: tok.warning, letterSpacing: 0.5, background: tok.warningSubtle, padding: '2px 7px', borderRadius: 5 }}>
              FLAGGED
            </div>
          )}
          <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled }}>
            {relativeTime(mem.created_at)}
          </div>
        </div>

        {/* text preview / full text */}
        <div style={{
          fontFamily: SANS, fontSize: 13.5, lineHeight: 1.65,
          color: tok.textSecondary,
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 3,
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
          marginBottom: 10,
        }}>
          {mem.text}
        </div>

        {/* entity chips */}
        {mem.entities.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
            {mem.entities.map(e => (
              <EntityChip key={e} tok={tok} label={e} />
            ))}
          </div>
        )}
      </div>

      {/* ── card footer ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px',
          borderTop: `1px solid ${tok.borderSubtle}`,
          background: expanded ? tok.surfaceElevated : 'transparent',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled }}>
          {mem.words}w
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled }}>·</div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled }}>
          {mem.vectors} vectors
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled }}>·</div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mem.source}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: tok.textDisabled, marginLeft: 'auto' }}>
          {mem.id}
        </div>

        {/* flag / unflag */}
        <div
          onClick={() => onFlag(mem.id)}
          title={mem.flagged ? 'Remove flag' : 'Flag for deletion'}
          style={{
            cursor: 'pointer', padding: '2px 4px', borderRadius: 5,
            color: mem.flagged ? tok.warning : tok.textDisabled,
            transition: 'color 120ms',
          }}
        >
          <Icon name="trash" size={13} color={mem.flagged ? tok.warning : tok.textDisabled} />
        </div>
      </div>
    </div>
  );
}

// ─── MemoryContent ────────────────────────────────────────────────────────────

function MemoryContent({ tok }) {
  const [memories,    setMemories]    = useState(MOCK_MEMORIES);
  const [search,      setSearch]      = useState(() => localStorage.getItem('ombra_memory_search') || '');
  const [topicFilter, setTopicFilter] = useState(() => localStorage.getItem('ombra_memory_topicFilter') || 'ALL');
  const [showFlagged, setShowFlagged] = useState(() => localStorage.getItem('ombra_memory_showFlagged') === 'true');
  const [sortOrder,   setSortOrder]   = useState(() => localStorage.getItem('ombra_memory_sortOrder') || 'newest');
  const [expandedId,  setExpandedId]  = useState(null);

  const width    = useWindowWidth();
  const isMobile = width < 768;

  useEffect(() => localStorage.setItem('ombra_memory_search', search), [search]);
  useEffect(() => localStorage.setItem('ombra_memory_topicFilter', topicFilter), [topicFilter]);
  useEffect(() => localStorage.setItem('ombra_memory_showFlagged', showFlagged), [showFlagged]);
  useEffect(() => localStorage.setItem('ombra_memory_sortOrder', sortOrder), [sortOrder]);

  const handleFlag = (id) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, flagged: !m.flagged } : m));
  };

  const filtered = useMemo(() => {
    let list = memories;
    if (showFlagged)        list = list.filter(m => m.flagged);
    if (topicFilter !== 'ALL') list = list.filter(m => m.topic === topicFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.text.toLowerCase().includes(q) ||
        m.entities.some(e => e.toLowerCase().includes(q)) ||
        m.topic.includes(q)
      );
    }
    return sortOrder === 'newest'
      ? [...list].sort((a, b) => b.created_at - a.created_at)
      : [...list].sort((a, b) => a.created_at - b.created_at);
  }, [memories, search, topicFilter, showFlagged, sortOrder]);

  const totalWords  = memories.reduce((s, m) => s + m.words, 0);
  const flaggedCount = memories.filter(m => m.flagged).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slide-up 200ms ease' }}>

      {/* ── Stats strip ── */}
      <div style={{
        display: 'flex', gap: 20, flexWrap: 'wrap',
        padding: '10px 16px',
        background: tok.surface, border: `1px solid ${tok.border}`,
        borderRadius: 12,
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            1,847
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            clusters
          </div>
        </div>
        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            284k
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            words
          </div>
        </div>
        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: flaggedCount > 0 ? tok.warning : tok.textPrimary, letterSpacing: -0.5 }}>
            {flaggedCount}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            flagged
          </div>
        </div>
        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            312
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            entities
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>

        {/* Search */}
        <input
          type="text"
          placeholder="search memories or entities…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: 11.5, color: tok.textSecondary,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: 9, padding: '7px 14px', outline: 'none',
            flex: 1, minWidth: 160,
          }}
        />

        {/* Topic filter */}
        {!isMobile && (
          <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} style={{
            fontFamily: MONO, fontSize: 11, color: tok.textSecondary,
            background: tok.surface, border: `1px solid ${tok.border}`,
            borderRadius: 9, padding: '7px 12px', cursor: 'pointer', outline: 'none',
          }}>
            <option value="ALL">all topics</option>
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {/* Sort */}
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{
          fontFamily: MONO, fontSize: 11, color: tok.textSecondary,
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 9, padding: '7px 12px', cursor: 'pointer', outline: 'none',
        }}>
          <option value="newest">newest first</option>
          <option value="oldest">oldest first</option>
        </select>

        {/* Flagged toggle */}
        <button
          onClick={() => setShowFlagged(f => !f)}
          style={{
            fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
            padding: '7px 14px', borderRadius: 9, cursor: 'pointer', outline: 'none',
            border: `1px solid ${showFlagged ? tok.warning : tok.border}`,
            background: showFlagged ? tok.warningSubtle : tok.surface,
            color: showFlagged ? tok.warning : tok.textMuted,
            transition: 'all 120ms',
          }}
        >
          {isMobile ? 'FLAGGED' : `FLAGGED${flaggedCount > 0 ? ` · ${flaggedCount}` : ''}`}
        </button>
      </div>

      {/* ── Memory grid ── */}
      {filtered.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 200, background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 14,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textDisabled, letterSpacing: 0.5 }}>
            no memories match filter
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
            />
          ))}
        </div>
      )}

      {/* ── Footer count ── */}
      <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3, textAlign: 'center', paddingBottom: 4 }}>
        {filtered.length !== memories.length
          ? `showing ${filtered.length} of ${memories.length} loaded clusters`
          : `showing ${filtered.length} clusters · 1,847 total`}
      </div>

    </div>
  );
}

Object.assign(window, { MemoryContent });
