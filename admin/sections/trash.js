const { useState } = React;

const MOCK_TRASH = [
  {
    id: 'clus-a1b2',
    event_type: 'small_talk',
    event_summary: 'Brief exchange about weekend plans — no actionable content or memorable context.',
    relevance_score: 0.08,
    started_at: Date.now() / 1000 - 86400 * 2,
    flagged_by: 'ai',
  },
  {
    id: 'clus-c3d4',
    event_type: 'media_consumption',
    event_summary: 'Background TV audio captured during dinner — fragmented speech, no coherent topic detected.',
    relevance_score: 0.04,
    started_at: Date.now() / 1000 - 86400 * 5,
    flagged_by: 'ai',
  },
  {
    id: 'clus-e5f6',
    event_type: 'conversation',
    event_summary: 'Discussion about a movie watched last night — personal taste, no projects or people relevant to my context.',
    relevance_score: 0.19,
    started_at: Date.now() / 1000 - 86400 * 1,
    flagged_by: 'user',
  },
];

function formatDate(unixSecs) {
  const d = new Date(unixSecs * 1000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EventTypeBadge({ tok, type }) {
  const label = type.replace(/_/g, ' ');
  return (
    <div style={{
      fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.6,
      textTransform: 'uppercase', color: tok.textMuted,
      background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
      borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </div>
  );
}

function RelevanceDot({ tok, score }) {
  const color = score < 0.1 ? tok.recording : score < 0.25 ? tok.warning : tok.success;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: tok.textMuted, letterSpacing: 0.3 }}>
        {score.toFixed(2)}
      </span>
    </div>
  );
}

function EmptyTrashModal({ tok, count, onClose, onConfirm }) {
  const [typed, setTyped] = useState('');
  const keyword = 'empty trash';
  const matches = typed.toLowerCase() === keyword;
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 18, boxShadow: tok.shadow3,
          width: '100%', maxWidth: 420, padding: '28px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
          animation: 'slide-up 180ms ease',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: tok.recordingSubtle, border: `1px solid ${tok.recording}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="trash" size={18} color={tok.recording} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: tok.textPrimary, lineHeight: 1.2 }}>
              Empty trash
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textMuted, marginTop: 5, lineHeight: 1.55 }}>
              Permanently deletes all {count} cluster{count !== 1 ? 's' : ''} in trash. This cannot be undone.
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textSecondary, marginBottom: 8 }}>
            Type <span style={{ fontFamily: MONO, fontSize: 12, color: tok.recording }}>{keyword}</span> to confirm
          </div>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches) { onConfirm(); onClose(); } }}
            placeholder={keyword}
            autoComplete="off"
            style={{
              width: '100%', fontFamily: MONO, fontSize: 13,
              color: tok.textPrimary, background: tok.surfaceElevated,
              border: `1px solid ${matches ? tok.recording : tok.border}`,
              borderRadius: 10, padding: '10px 14px', outline: 'none',
              transition: 'border-color 120ms',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 500,
              color: tok.textSecondary, background: 'transparent',
              border: `1px solid ${tok.border}`, borderRadius: 10,
              padding: '9px 18px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (matches) { onConfirm(); onClose(); } }}
            disabled={!matches}
            style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 500,
              color: '#fff', background: tok.recording, border: 'none',
              borderRadius: 10, padding: '9px 18px',
              cursor: matches ? 'pointer' : 'default',
              opacity: matches ? 1 : 0.35,
              transition: 'opacity 150ms',
            }}
          >
            Empty trash
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ClusterCard({ tok, cluster, onRestore, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (confirming) {
      onDelete(cluster.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <div style={{
      padding: '16px 0',
      borderBottom: `1px solid ${tok.borderSubtle}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <EventTypeBadge tok={tok} type={cluster.event_type} />
        <RelevanceDot tok={tok} score={cluster.relevance_score} />
        <div style={{
          fontFamily: SANS, fontSize: 10.5, color: tok.textDisabled,
          marginLeft: 'auto', flexShrink: 0,
        }}>
          {formatDate(cluster.started_at)}
        </div>
      </div>

      <div style={{ fontFamily: SANS, fontSize: 13, color: tok.textSecondary, lineHeight: 1.6 }}>
        {cluster.event_summary}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
            color: cluster.flagged_by === 'ai' ? tok.accent : tok.warning,
            background: cluster.flagged_by === 'ai' ? tok.accentSubtle : tok.warningSubtle,
            border: `1px solid ${cluster.flagged_by === 'ai' ? tok.accentBorder : tok.warning + '44'}`,
            borderRadius: 5, padding: '2px 7px',
          }}>
            {cluster.flagged_by === 'ai' ? 'AI review' : 'By you'}
          </div>
          <span style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3 }}>
            {cluster.id}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => onRestore(cluster.id)}
            style={{
              fontFamily: SANS, fontSize: 12, fontWeight: 500,
              color: tok.success, background: tok.successSubtle,
              border: `1px solid ${tok.success}44`, borderRadius: 8,
              padding: '5px 12px', cursor: 'pointer',
              transition: 'border-color 120ms',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = tok.success}
            onMouseLeave={e => e.currentTarget.style.borderColor = `${tok.success}44`}
          >
            Restore
          </button>
          <button
            onClick={handleDelete}
            style={{
              fontFamily: SANS, fontSize: 12, fontWeight: 500,
              color: confirming ? '#fff' : tok.recording,
              background: confirming ? tok.recording : 'transparent',
              border: `1px solid ${tok.recording}`,
              borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
              transition: 'background 140ms, color 140ms',
              whiteSpace: 'nowrap',
            }}
          >
            {confirming ? 'Confirm delete' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrashContent({ tok }) {
  const [items, setItems]       = useState(MOCK_TRASH);
  const [showModal, setShowModal] = useState(false);

  const restore = (id) => setItems(prev => prev.filter(c => c.id !== id));
  const remove  = (id) => setItems(prev => prev.filter(c => c.id !== id));
  const emptyAll = ()  => setItems([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-up 200ms ease' }}>

      {/* Header panel */}
      <div style={{
        background: tok.surface, border: `1px solid ${tok.border}`,
        borderRadius: 16, padding: '16px 24px', boxShadow: tok.shadow1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 500, color: tok.textPrimary }}>
            {items.length === 0
              ? 'Trash is empty'
              : `${items.length} cluster${items.length !== 1 ? 's' : ''} in trash`}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11.5, color: tok.textMuted, marginTop: 2 }}>
            Restore to keep, or delete permanently to free space
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              fontFamily: SANS, fontSize: 12.5, fontWeight: 500, flexShrink: 0,
              color: tok.recording, background: 'transparent',
              border: `1px solid ${tok.recording}`, borderRadius: 10,
              padding: '8px 16px', cursor: 'pointer',
              transition: 'background 140ms, color 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = tok.recording; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = tok.recording; }}
          >
            Empty trash
          </button>
        )}
      </div>

      {/* List */}
      {items.length > 0 ? (
        <div style={{
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 16, padding: '4px 24px', boxShadow: tok.shadow1,
        }}>
          {items.map(c => (
            <ClusterCard
              key={c.id}
              tok={tok}
              cluster={c}
              onRestore={restore}
              onDelete={remove}
            />
          ))}
        </div>
      ) : (
        <div style={{
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 16, padding: '48px 24px', boxShadow: tok.shadow1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: tok.surfaceElevated, border: `1px solid ${tok.borderSubtle}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="trash" size={24} color={tok.textDisabled} strokeWidth={1.2} />
          </div>
          <div style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textMuted }}>Trash is empty</div>
        </div>
      )}

      {showModal && (
        <EmptyTrashModal
          tok={tok}
          count={items.length}
          onClose={() => setShowModal(false)}
          onConfirm={emptyAll}
        />
      )}

    </div>
  );
}

Object.assign(window, { TrashContent });
