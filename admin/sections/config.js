const { useState, useEffect } = React;

const LANGUAGES = [
  { code: 'en', label: 'English'    },
  { code: 'da', label: 'Danish'     },
  { code: 'de', label: 'German'     },
  { code: 'fr', label: 'French'     },
  { code: 'es', label: 'Spanish'    },
  { code: 'it', label: 'Italian'    },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch'      },
  { code: 'pl', label: 'Polish'     },
  { code: 'sv', label: 'Swedish'    },
  { code: 'no', label: 'Norwegian'  },
  { code: 'fi', label: 'Finnish'    },
  { code: 'ja', label: 'Japanese'   },
  { code: 'ko', label: 'Korean'     },
  { code: 'zh', label: 'Chinese'    },
];

function CPanel({ tok, children, style = {} }) {
  return (
    <div style={{
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '20px 24px', boxShadow: tok.shadow1,
      ...style,
    }}>
      {children}
    </div>
  );
}

function CPanelTitle({ tok, children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted }}>
        {children}
      </div>
      {action}
    </div>
  );
}

function FieldLabel({ tok, children, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: tok.textSecondary }}>{children}</div>
      {hint && <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>{hint}</div>}
    </div>
  );
}

function ConfigInput({ tok, value, onChange, type = 'text', min, max, placeholder }) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={e => onChange(type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value)}
      style={{
        width: '100%', fontFamily: MONO, fontSize: 13, color: tok.textPrimary,
        background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
        borderRadius: 10, padding: '9px 14px', outline: 'none',
        WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
        transition: 'border-color 120ms',
      }}
      onFocus={e => e.target.style.borderColor = tok.accent}
      onBlur={e => e.target.style.borderColor = tok.border}
    />
  );
}

function ConfigSelect({ tok, value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', fontFamily: MONO, fontSize: 13, color: tok.textPrimary,
          background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
          borderRadius: 10, padding: '9px 36px 9px 14px', outline: 'none',
          WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
          cursor: 'pointer', transition: 'border-color 120ms',
        }}
        onFocus={e => e.target.style.borderColor = tok.accent}
        onBlur={e => e.target.style.borderColor = tok.border}
      >
        {options.map(o => (
          <option key={o.code} value={o.code}>{o.label} ({o.code})</option>
        ))}
      </select>
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', lineHeight: 0 }}>
        <Icon name="chevron-down" size={14} color={tok.textMuted} />
      </div>
    </div>
  );
}

function KVRow({ tok, label, value, mono = true, valueColor, last, badge, dim }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0',
      borderBottom: last ? 'none' : `1px solid ${tok.borderSubtle}`,
    }}>
      <div style={{ fontFamily: SANS, fontSize: 12.5, color: dim ? tok.textDisabled : tok.textMuted }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge && (
          <div style={{
            fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
            color: badge.color, background: badge.bg,
            borderRadius: 5, padding: '2px 7px',
          }}>{badge.text}</div>
        )}
        <div style={{
          fontFamily: mono ? MONO : SANS, fontSize: 11.5,
          color: dim ? tok.textDisabled : (valueColor || tok.textSecondary),
          letterSpacing: mono ? 0.2 : 0,
        }}>{value}</div>
      </div>
    </div>
  );
}

function FileManagedNote({ tok }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, marginTop: 14,
      padding: '7px 11px', background: tok.accentSubtle,
      border: `1px solid ${tok.accentBorder}`, borderRadius: 9,
    }}>
      <Icon name="shield" size={13} color={tok.accent} />
      <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>
        Read-only · managed via <span style={{ fontFamily: MONO, fontSize: 10.5 }}>config.toml</span>
      </span>
    </div>
  );
}

function GeneralSettingsPanel({ tok }) {
  const [form, setForm] = useState({
    response_language: 'en',
    cluster_timeout_minutes: 5,
    profile_encounter_threshold: 5,
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/settings')
      .then(r => r.json())
      .then(data => {
        setForm({
          response_language: data.response_language || 'en',
          cluster_timeout_minutes: data.cluster_timeout_minutes ?? 5,
          profile_encounter_threshold: data.profile_encounter_threshold ?? 5,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setStatus('saving');
    try {
      const r = await fetch('/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      setStatus('saved');
      setTimeout(() => setStatus(null), 2500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <CPanel tok={tok}>
      <CPanelTitle tok={tok}>General Settings</CPanelTitle>

      {loading ? (
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted, padding: '20px 0', textAlign: 'center' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div>
            <FieldLabel tok={tok} hint="Language Ombra responds in">Response Language</FieldLabel>
            <ConfigSelect
              tok={tok}
              value={form.response_language}
              onChange={v => setForm(f => ({ ...f, response_language: v }))}
              options={LANGUAGES}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel tok={tok} hint="Minutes of silence before session closes">Cluster Timeout</FieldLabel>
              <ConfigInput
                tok={tok}
                type="number"
                min={1}
                max={120}
                value={form.cluster_timeout_minutes}
                onChange={v => setForm(f => ({ ...f, cluster_timeout_minutes: v }))}
              />
            </div>
            <div>
              <FieldLabel tok={tok} hint="Encounters before a profile is built">Encounter Threshold</FieldLabel>
              <ConfigInput
                tok={tok}
                type="number"
                min={1}
                max={50}
                value={form.profile_encounter_threshold}
                onChange={v => setForm(f => ({ ...f, profile_encounter_threshold: v }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 2 }}>
            <button
              onClick={save}
              disabled={status === 'saving'}
              style={{
                fontFamily: SANS, fontSize: 13, fontWeight: 500,
                color: '#fff', background: tok.accent, border: 'none',
                borderRadius: 10, padding: '9px 22px',
                cursor: status === 'saving' ? 'default' : 'pointer',
                opacity: status === 'saving' ? 0.65 : 1,
                transition: 'opacity 120ms',
              }}
            >
              {status === 'saving' ? 'Saving…' : 'Save Settings'}
            </button>

            {status === 'saved' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 12.5, color: tok.success }}>
                <Icon name="check" size={14} color={tok.success} strokeWidth={2.5} />
                Saved
              </div>
            )}
            {status === 'error' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 12.5, color: tok.recording }}>
                <Icon name="x" size={14} color={tok.recording} strokeWidth={2.5} />
                Failed to save
              </div>
            )}
          </div>

        </div>
      )}
    </CPanel>
  );
}

function TlsPanel({ tok }) {
  const rows = [
    { label: 'Server certificate', value: 'certs/server.crt',    badge: { text: 'Valid', color: tok.success, bg: tok.successSubtle } },
    { label: 'Server key',         value: 'certs/server.key',    badge: null },
    { label: 'Client CA cert',     value: 'certs/client-ca.crt', badge: { text: 'Valid', color: tok.success, bg: tok.successSubtle } },
    { label: 'Client cert',        value: 'certs/client.crt',    badge: { text: 'Valid', color: tok.success, bg: tok.successSubtle } },
    { label: 'Client key',         value: 'certs/client.key',    badge: null },
  ];

  return (
    <CPanel tok={tok} style={{ flex: 1, minWidth: 0 }}>
      <CPanelTitle tok={tok}>TLS · mTLS</CPanelTitle>
      {rows.map((r, i) => (
        <KVRow key={r.label} tok={tok} label={r.label} value={r.value} badge={r.badge} last={i === rows.length - 1} />
      ))}
      <FileManagedNote tok={tok} />
    </CPanel>
  );
}

function DdnsPanel({ tok }) {
  const rows = [
    { label: 'Status',    value: 'Not configured', dim: true },
    { label: 'Provider',  value: '—',              dim: true },
    { label: 'Subdomain', value: '—',              dim: true },
    { label: 'Hostname',  value: '—',              dim: true, last: true },
  ];

  return (
    <CPanel tok={tok} style={{ flex: 1, minWidth: 0 }}>
      <CPanelTitle tok={tok}>DDNS</CPanelTitle>
      {rows.map((r, i) => (
        <KVRow key={r.label} tok={tok} label={r.label} value={r.value} dim={r.dim} last={r.last} />
      ))}
      <FileManagedNote tok={tok} />
    </CPanel>
  );
}

function DangerModal({ tok, action, onClose }) {
  const [typed, setTyped] = useState('');
  const inputRef = React.useRef(null);
  const matches = typed.toLowerCase() === action.keyword;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleConfirm = () => {
    if (!matches) return;
    onClose();
    // TODO: call action.onConfirm() once backend endpoint exists
  };

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: tok.surface, border: `1px solid ${tok.border}`,
          borderRadius: 18, boxShadow: tok.shadow3,
          width: '100%', maxWidth: 440,
          padding: '28px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
          animation: 'slide-up 180ms ease',
        }}
      >
        {/* Header */}
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
              {action.title}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textMuted, marginTop: 5, lineHeight: 1.55 }}>
              {action.description}
            </div>
          </div>
        </div>

        {/* Input prompt */}
        <div>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textSecondary, marginBottom: 8 }}>
            Type <span style={{ fontFamily: MONO, fontSize: 12, color: tok.recording }}>{action.keyword}</span> to confirm
          </div>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches) handleConfirm(); }}
            placeholder={action.keyword}
            autoComplete="off"
            style={{
              width: '100%', fontFamily: MONO, fontSize: 13.5,
              color: tok.textPrimary, background: tok.surfaceElevated,
              border: `1px solid ${matches ? tok.recording : tok.border}`,
              borderRadius: 10, padding: '10px 14px', outline: 'none',
              transition: 'border-color 120ms',
            }}
          />
        </div>

        {/* Actions */}
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
            onClick={handleConfirm}
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
            {action.buttonLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DangerZonePanel({ tok }) {
  const [modal, setModal] = useState(null);

  const ACTIONS = {
    purge: {
      title: 'Purge all memories',
      description: 'Permanently deletes all clusters, transcripts, and vector embeddings. Entities are preserved. This cannot be undone.',
      keyword: 'purge',
      buttonLabel: 'Purge all memories',
    },
    reset: {
      title: 'Factory reset',
      description: 'Wipes all data, certificates, and configuration. Returns Ombra to a fresh install state. This cannot be undone.',
      keyword: 'reset',
      buttonLabel: 'Factory reset',
    },
  };

  const dangerRow = (actionKey, sub) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 0' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: tok.textSecondary }}>
          {ACTIONS[actionKey].title}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: tok.textMuted, marginTop: 3, lineHeight: 1.5 }}>{sub}</div>
      </div>
      <button
        onClick={() => setModal(actionKey)}
        style={{
          flexShrink: 0, fontFamily: SANS, fontSize: 12.5, fontWeight: 500,
          color: tok.recording, background: 'transparent',
          border: `1px solid ${tok.recording}`,
          borderRadius: 10, padding: '8px 16px',
          cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'background 140ms, color 140ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = tok.recording; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = tok.recording; }}
      >
        {ACTIONS[actionKey].buttonLabel.split(' ')[0]}
      </button>
    </div>
  );

  return (
    <>
      <CPanel tok={tok} style={{ borderColor: `${tok.recording}44` }}>
        <CPanelTitle tok={tok}>
          <span style={{ color: tok.recording }}>Danger Zone</span>
        </CPanelTitle>

        {dangerRow('purge', 'Permanently deletes all clusters, transcripts, and vector embeddings. Entities are preserved.')}

        <div style={{ height: 1, background: tok.borderSubtle }} />

        {dangerRow('reset', 'Wipes all data, certificates, and config. Returns Ombra to a fresh install state.')}
      </CPanel>

      {modal && (
        <DangerModal tok={tok} action={ACTIONS[modal]} onClose={() => setModal(null)} />
      )}
    </>
  );
}

function ConfigContent({ tok }) {
  const width    = useWindowWidth();
  const isMobile = width < 768;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-up 200ms ease' }}>

      <GeneralSettingsPanel tok={tok} />

      {isMobile ? (
        <>
          <TlsPanel  tok={tok} />
          <DdnsPanel tok={tok} />
        </>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          <TlsPanel  tok={tok} />
          <DdnsPanel tok={tok} />
        </div>
      )}

      <DangerZonePanel tok={tok} />

    </div>
  );
}

Object.assign(window, { ConfigContent });
