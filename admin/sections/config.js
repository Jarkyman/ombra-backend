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

function certBadge(info, tok) {
  if (!info) return null;
  if (info.status === 'unreadable') return { text: '?', color: tok.textMuted, bg: tok.surfaceElevated };
  if (info.status === 'expired')    return { text: 'Expired', color: tok.recording, bg: tok.recordingSubtle };
  if (info.status === 'critical')   return { text: `${info.days_remaining}d`, color: tok.recording, bg: tok.recordingSubtle };
  if (info.status === 'expiring_soon') return { text: `${info.days_remaining}d`, color: tok.warning, bg: tok.warningSubtle };
  return { text: `${info.days_remaining}d`, color: tok.success, bg: tok.successSubtle };
}

function TlsPanel({ tok }) {
  const [certData, setCertData] = useState(null);
  const [renewing, setRenewing] = useState(false);
  const [renewResult, setRenewResult] = useState(null); // null | 'ok' | 'error' | 'no_ca'

  useEffect(() => {
    fetch('/admin/cert-status')
      .then(r => r.json())
      .then(setCertData)
      .catch(() => {});
  }, []);

  const handleRenew = async () => {
    setRenewing(true);
    setRenewResult(null);
    try {
      const r = await fetch('/admin/renew-server-cert', { method: 'POST' });
      if (r.status === 422) {
        setRenewResult('no_ca');
      } else if (!r.ok) {
        setRenewResult('error');
      } else {
        setRenewResult('ok');
        const fresh = await fetch('/admin/cert-status').then(r => r.json());
        setCertData(fresh);
      }
    } catch {
      setRenewResult('error');
    } finally {
      setRenewing(false);
    }
  };

  const renewBtn = (
    <button
      onClick={handleRenew}
      disabled={renewing}
      style={{
        fontFamily: SANS, fontSize: 11, fontWeight: 500,
        color: tok.accent, background: 'transparent',
        border: `1px solid ${tok.accentBorder}`, borderRadius: 8,
        padding: '5px 12px', cursor: renewing ? 'default' : 'pointer',
        opacity: renewing ? 0.6 : 1, transition: 'opacity 120ms',
      }}
    >
      {renewing ? 'Renewing…' : 'Renew server cert'}
    </button>
  );

  const certRows = certData ? [
    { label: 'Server certificate', info: certData.server_cert },
    { label: 'Client CA cert',     info: certData.client_ca   },
    { label: 'Client cert',        info: certData.client_cert },
  ] : [];

  return (
    <CPanel tok={tok} style={{ flex: 1, minWidth: 0 }}>
      <CPanelTitle tok={tok} action={renewBtn}>TLS · mTLS</CPanelTitle>

      {!certData && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted, padding: '16px 0', textAlign: 'center' }}>
          Loading…
        </div>
      )}

      {certRows.map((r, i) => (
        <KVRow
          key={r.label}
          tok={tok}
          label={r.label}
          value={r.info.path}
          badge={certBadge(r.info, tok)}
          last={i === certRows.length - 1}
        />
      ))}

      {renewResult && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          marginTop: 12, padding: '7px 11px',
          background: renewResult === 'ok' ? tok.successSubtle : tok.recordingSubtle,
          border: `1px solid ${renewResult === 'ok' ? tok.success : tok.recording}44`,
          borderRadius: 9,
        }}>
          <Icon
            name={renewResult === 'ok' ? 'check' : 'x'}
            size={13}
            color={renewResult === 'ok' ? tok.success : tok.recording}
            strokeWidth={2.5}
          />
          <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>
            {renewResult === 'ok'    && 'Server certificate renewed — TLS hot-reloaded.'}
            {renewResult === 'no_ca' && 'CA private key (certs/ca.key) not found. Run generate_dev_certs.sh first.'}
            {renewResult === 'error' && 'Renewal failed. Check server logs for details.'}
          </span>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, marginTop: 14,
        padding: '7px 11px', background: tok.accentSubtle,
        border: `1px solid ${tok.accentBorder}`, borderRadius: 9,
      }}>
        <Icon name="shield" size={13} color={tok.accent} />
        <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>
          Cert paths configured in <span style={{ fontFamily: MONO, fontSize: 10.5 }}>config.toml</span> · badge shows days until expiry
        </span>
      </div>
    </CPanel>
  );
}

function connectionModeBadge(mode, tok) {
  switch (mode) {
    case 'local_only':        return { text: 'Local only',  color: tok.textSecondary, bg: tok.surfaceElevated };
    case 'tailscale':         return { text: 'Tailscale',   color: '#6875f5',         bg: '#6875f520'         };
    case 'duck_dns':          return { text: 'DuckDNS',     color: '#f59e0b',         bg: '#f59e0b20'         };
    case 'ombra_dns':         return { text: 'OmbraDNS',    color: tok.accent,        bg: tok.accentSubtle    };
    default:                  return { text: mode,          color: tok.textMuted,      bg: tok.surfaceElevated };
  }
}

function leCertBadge(days, tok) {
  if (days === null || days === undefined) return null;
  if (days < 0)  return { text: 'Expired',        color: tok.recording, bg: tok.recordingSubtle };
  if (days < 7)  return { text: `${days}d`,        color: tok.recording, bg: tok.recordingSubtle };
  if (days < 30) return { text: `${days}d`,        color: tok.warning,   bg: tok.warningSubtle   };
  return           { text: `${days}d`,        color: tok.success,  bg: tok.successSubtle   };
}

function ConnectionPanel({ tok }) {
  const [data, setData] = useState(null);
  const [renewing, setRenewing] = useState(false);
  const [renewResult, setRenewResult] = useState(null); // null | 'ok' | 'error'

  const reload = () => {
    fetch('/admin/connection-status')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  };

  useEffect(() => { reload(); }, []);

  const handleForceRenew = async () => {
    setRenewing(true);
    setRenewResult(null);
    try {
      const r = await fetch('/admin/le/renew', { method: 'POST' });
      if (!r.ok) {
        setRenewResult('error');
      } else {
        setRenewResult('ok');
        setTimeout(reload, 5000);
      }
    } catch {
      setRenewResult('error');
    } finally {
      setRenewing(false);
    }
  };

  if (!data) {
    return (
      <CPanel tok={tok} style={{ flex: 1, minWidth: 0 }}>
        <CPanelTitle tok={tok}>Connection</CPanelTitle>
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted, padding: '16px 0', textAlign: 'center' }}>Loading…</div>
      </CPanel>
    );
  }

  const isDuckDns = data.mode === 'duck_dns';
  const modeBadge = connectionModeBadge(data.mode, tok);

  const renewBtn = isDuckDns ? (
    <button
      onClick={handleForceRenew}
      disabled={renewing}
      style={{
        fontFamily: SANS, fontSize: 11, fontWeight: 500,
        color: tok.accent, background: 'transparent',
        border: `1px solid ${tok.accentBorder}`, borderRadius: 8,
        padding: '5px 12px', cursor: renewing ? 'default' : 'pointer',
        opacity: renewing ? 0.6 : 1, transition: 'opacity 120ms',
      }}
    >
      {renewing ? 'Renewing…' : 'Renew LE cert'}
    </button>
  ) : null;

  const rows = [
    { label: 'Mode',        value: data.mode.replace(/_/g, ' '), badge: modeBadge },
    { label: 'LAN IP',      value: data.lan_ip   || '—' },
    { label: 'Server port', value: String(data.server_port) },
    ...(data.tailscale_ip
      ? [{ label: 'Tailscale IP', value: data.tailscale_ip }]
      : []),
    ...(isDuckDns && data.duckdns_hostname
      ? [
          { label: 'DuckDNS hostname', value: data.duckdns_hostname },
          { label: 'Token set',        value: data.duckdns_token_set ? 'Yes' : 'No' },
          {
            label: 'LE cert',
            value: data.le_cert_days_remaining != null ? `${data.le_cert_days_remaining}d remaining` : 'Not issued',
            badge: leCertBadge(data.le_cert_days_remaining, tok),
          },
        ]
      : []),
  ];

  return (
    <CPanel tok={tok} style={{ flex: 1, minWidth: 0 }}>
      <CPanelTitle tok={tok} action={renewBtn}>Connection</CPanelTitle>
      {rows.map((r, i) => (
        <KVRow
          key={r.label}
          tok={tok}
          label={r.label}
          value={r.value}
          badge={r.badge}
          last={i === rows.length - 1}
        />
      ))}

      {renewResult && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          marginTop: 12, padding: '7px 11px',
          background: renewResult === 'ok' ? tok.successSubtle : tok.recordingSubtle,
          border: `1px solid ${renewResult === 'ok' ? tok.success : tok.recording}44`,
          borderRadius: 9,
        }}>
          <Icon
            name={renewResult === 'ok' ? 'check' : 'x'}
            size={13}
            color={renewResult === 'ok' ? tok.success : tok.recording}
            strokeWidth={2.5}
          />
          <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>
            {renewResult === 'ok'
              ? 'Renewal started — takes ~2 min. Badge updates automatically.'
              : 'Renewal request failed. Check server logs.'}
          </span>
        </div>
      )}

      <FileManagedNote tok={tok} />
    </CPanel>
  );
}

function DangerModal({ tok, action, onClose }) {
  const [typed,  setTyped]  = useState('');
  const [status, setStatus] = useState(null); // null | 'running' | 'done' | 'error'
  const inputRef = React.useRef(null);
  const matches  = typed.toLowerCase() === action.keyword;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && status !== 'running') onClose(); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    return () => document.removeEventListener('keydown', onKey);
  }, [status]);

  const handleConfirm = async () => {
    if (!matches || status === 'running') return;
    setStatus('running');
    try {
      await action.onConfirm();
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return ReactDOM.createPortal(
    <div
      onClick={status === 'running' ? undefined : onClose}
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
            background: status === 'done'
              ? tok.successSubtle
              : status === 'error'
                ? tok.warningSubtle
                : tok.recordingSubtle,
            border: `1px solid ${status === 'done' ? tok.success : status === 'error' ? tok.warning : tok.recording}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon
              name={status === 'done' ? 'check' : status === 'error' ? 'x' : 'trash'}
              size={18}
              color={status === 'done' ? tok.success : status === 'error' ? tok.warning : tok.recording}
              strokeWidth={1.5}
            />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: tok.textPrimary, lineHeight: 1.2 }}>
              {status === 'done'
                ? 'Done'
                : status === 'error'
                  ? 'Something went wrong'
                  : action.title}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textMuted, marginTop: 5, lineHeight: 1.55 }}>
              {status === 'done'
                ? action.doneMessage
                : status === 'error'
                  ? 'The operation failed. Check the server logs for details.'
                  : action.description}
            </div>
          </div>
        </div>

        {/* Input prompt — hidden after confirm */}
        {!status && (
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
        )}

        {/* Loading indicator */}
        {status === 'running' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 12, color: tok.textMuted }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: `2px solid ${tok.border}`,
              borderTopColor: tok.accent,
              animation: 'spin 0.7s linear infinite',
            }} />
            Working…
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {status === 'done' && action.showReload && (
            <button
              onClick={() => window.location.reload()}
              style={{
                fontFamily: SANS, fontSize: 13, fontWeight: 500,
                color: '#fff', background: tok.accent, border: 'none',
                borderRadius: 10, padding: '9px 18px', cursor: 'pointer',
              }}
            >
              Reload page
            </button>
          )}

          {(status === 'done' || status === 'error') && (
            <button
              onClick={onClose}
              style={{
                fontFamily: SANS, fontSize: 13, fontWeight: 500,
                color: tok.textSecondary, background: 'transparent',
                border: `1px solid ${tok.border}`, borderRadius: 10,
                padding: '9px 18px', cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}

          {!status && (
            <>
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
            </>
          )}
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
      title:       'Purge all memories',
      description: 'Permanently deletes all clusters, transcripts, and vector embeddings. Entities are preserved. This cannot be undone.',
      keyword:     'purge',
      buttonLabel: 'Purge all memories',
      doneMessage: 'All clusters, transcripts, and embeddings have been deleted. Entities are intact.',
      showReload:  false,
      onConfirm:   async () => {
        const r = await fetch('/admin/purge', { method: 'POST' });
        if (!r.ok) throw new Error(`${r.status}`);
      },
    },
    reset: {
      title:       'Factory reset',
      description: 'Wipes all captured data — sessions, clusters, entities, embeddings, and profile. Config and certificates are kept. This cannot be undone.',
      keyword:     'reset',
      buttonLabel: 'Factory reset',
      doneMessage: 'All data has been wiped. Reload the page to start fresh.',
      showReload:  true,
      onConfirm:   async () => {
        const r = await fetch('/admin/factory-reset', { method: 'POST' });
        if (!r.ok) throw new Error(`${r.status}`);
      },
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
          <ConnectionPanel tok={tok} />
        </>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          <TlsPanel  tok={tok} />
          <ConnectionPanel tok={tok} />
        </div>
      )}

      <DangerZonePanel tok={tok} />

    </div>
  );
}

Object.assign(window, { ConfigContent });
