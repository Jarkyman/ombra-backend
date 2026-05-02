const { useState, useEffect, useRef } = React;

function formatRelativeTime(unixSecs) {
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSecs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(unixSecs) {
  return new Date(unixSecs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DeviceIcon({ size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="3"/>
      <path d="M12 18h.01"/>
    </svg>
  );
}

function StatusBadge({ tok, revoked }) {
  const s = revoked
    ? { text: 'Revoked', color: tok.recording, bg: tok.recordingSubtle }
    : { text: 'Active',  color: tok.success,   bg: tok.successSubtle   };
  return (
    <div style={{
      fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
      color: s.color, background: s.bg,
      borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap',
    }}>{s.text}</div>
  );
}

function RevokeModal({ tok, device, onClose, onSuccess }) {
  const [typed,   setTyped]   = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const matches  = typed === device.label;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleConfirm = () => {
    if (!matches || loading) return;
    setLoading(true);
    fetch(`/admin/devices/${encodeURIComponent(device.cn)}/revoke`, { method: 'POST' })
      .then(r => {
        if (r.ok || r.status === 204) { onSuccess(); onClose(); }
        else setLoading(false);
      })
      .catch(() => setLoading(false));
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
          width: '100%', maxWidth: 420,
          padding: '28px 28px 24px',
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
            <DeviceIcon size={18} color={tok.recording} />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: tok.textPrimary, lineHeight: 1.2 }}>
              Revoke access
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textMuted, marginTop: 5, lineHeight: 1.55 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: tok.textSecondary }}>{device.label}</span> will
              immediately lose access to Ombra. This cannot be undone.
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textSecondary, marginBottom: 8 }}>
            Type <span style={{ fontFamily: MONO, fontSize: 12, color: tok.recording }}>{device.label}</span> to confirm
          </div>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches) handleConfirm(); }}
            placeholder={device.label}
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
            onClick={handleConfirm}
            disabled={!matches || loading}
            style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 500,
              color: '#fff', background: tok.recording, border: 'none',
              borderRadius: 10, padding: '9px 18px',
              cursor: matches && !loading ? 'pointer' : 'default',
              opacity: matches && !loading ? 1 : 0.35,
              transition: 'opacity 150ms',
            }}
          >
            {loading ? 'Revoking…' : 'Revoke access'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function QRCode({ value, size = 140, color }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const N = qr.getModuleCount();
  const cell = size / N;
  const rects = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (qr.isDark(r, c)) {
        rects.push(<rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={color} />);
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{rects}</svg>
  );
}

function AddDevicePanel({ tok, dark }) {
  const [payload,    setPayload]    = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState(null);
  const qrColor = dark ? '#F0EDE8' : '#1C1917';

  const generate = () => {
    setGenerating(true);
    setError(null);
    fetch('/provision/rotate', { method: 'POST' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setPayload(data); setGenerating(false); })
      .catch(() => { setError('Failed to generate provision QR.'); setGenerating(false); });
  };

  return (
    <div style={{
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '20px 24px', boxShadow: tok.shadow1,
      display: 'flex', gap: 24, alignItems: 'center',
    }}>
      <div style={{ flexShrink: 0 }}>
        {payload ? (
          <div style={{
            padding: 10, background: dark ? tok.surfaceElevated : '#fff',
            borderRadius: 12, border: `1px solid ${tok.borderSubtle}`, lineHeight: 0,
          }}>
            <QRCode value={JSON.stringify(payload)} size={120} color={qrColor} />
          </div>
        ) : (
          <div style={{
            width: 140, height: 140, borderRadius: 12,
            border: `1px dashed ${tok.border}`, background: tok.surfaceElevated,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="shield" size={32} color={tok.textDisabled} strokeWidth={1.2} />
          </div>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted, marginBottom: 8 }}>
          Add Device
        </div>

        {payload ? (
          <>
            <div style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textPrimary, lineHeight: 1.55, marginBottom: 10 }}>
              Scan with the Ombra app to provision this device. The token is single-use.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{
                fontFamily: MONO, fontSize: 11, color: tok.accent,
                background: tok.accentSubtle, border: `1px solid ${tok.accentBorder}`,
                borderRadius: 8, padding: '5px 10px', letterSpacing: 0.3,
              }}>
                {payload.host}:{payload.provision_port}
              </div>
              <button
                onClick={generate}
                style={{
                  fontFamily: SANS, fontSize: 12, fontWeight: 500,
                  color: tok.textSecondary, background: 'transparent',
                  border: `1px solid ${tok.border}`, borderRadius: 8,
                  padding: '5px 12px', cursor: 'pointer',
                }}
              >
                Regenerate
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textPrimary, lineHeight: 1.55, marginBottom: 12 }}>
              Generate a one-time QR code to provision a new trusted device via the Ombra app.
            </div>
            {error && (
              <div style={{ fontFamily: SANS, fontSize: 12, color: tok.recording, marginBottom: 10 }}>{error}</div>
            )}
            <button
              onClick={generate}
              disabled={generating}
              style={{
                fontFamily: SANS, fontSize: 13, fontWeight: 500,
                color: '#fff', background: tok.accent, border: 'none',
                borderRadius: 10, padding: '9px 20px',
                cursor: generating ? 'default' : 'pointer',
                opacity: generating ? 0.6 : 1,
                transition: 'opacity 150ms',
              }}
            >
              {generating ? 'Generating…' : 'Generate QR'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const TABLE_COLS = '1fr 180px 90px 120px 100px 120px';

function DeviceRow({ tok, device, isMobile, onRevoke, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(device);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const revokeBtn = (
    <button
      onClick={() => onRevoke(device)}
      style={{
        fontFamily: SANS, fontSize: 11.5, fontWeight: 500,
        color: tok.recording, background: 'transparent',
        border: `1px solid ${tok.recording}44`, borderRadius: 8,
        padding: '5px 12px', cursor: 'pointer',
        transition: 'border-color 120ms, background 120ms',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = tok.recording; e.currentTarget.style.background = tok.recordingSubtle; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${tok.recording}44`; e.currentTarget.style.background = 'transparent'; }}
    >
      Revoke
    </button>
  );

  const deleteBtn = (
    <button
      onClick={handleDeleteClick}
      style={{
        fontFamily: SANS, fontSize: 11.5, fontWeight: 500,
        color: confirmDelete ? '#fff' : tok.textMuted,
        background: confirmDelete ? tok.recording : 'transparent',
        border: `1px solid ${confirmDelete ? tok.recording : tok.borderSubtle}`,
        borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
        transition: 'background 140ms, color 140ms, border-color 140ms',
        whiteSpace: 'nowrap',
      }}
    >
      {confirmDelete ? 'Confirm?' : 'Delete'}
    </button>
  );

  if (isMobile) {
    return (
      <div style={{
        padding: '14px 0', borderBottom: `1px solid ${tok.borderSubtle}`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DeviceIcon size={15} color={tok.textSecondary} />
            <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 500, color: tok.textPrimary }}>{device.label}</span>
          </div>
          <StatusBadge tok={tok} revoked={device.revoked} />
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: tok.textMuted }}>{device.cn}</span>
          <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textDisabled }}>last seen {formatRelativeTime(device.last_seen)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!device.revoked && revokeBtn}
          {deleteBtn}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: TABLE_COLS,
      alignItems: 'center', gap: 12,
      padding: '13px 0', borderBottom: `1px solid ${tok.borderSubtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <DeviceIcon size={15} color={tok.textSecondary} />
        <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: tok.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {device.label}
        </span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {device.cn}
      </span>
      <StatusBadge tok={tok} revoked={device.revoked} />
      <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textDisabled }}>
        {formatDate(device.first_seen)}
      </span>
      <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textDisabled }}>
        {formatRelativeTime(device.last_seen)}
      </span>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        {!device.revoked && revokeBtn}
        {deleteBtn}
      </div>
    </div>
  );
}

function DeviceListPanel({ tok, isMobile, devices, loading, onRevoke, onDelete }) {
  if (loading) {
    return (
      <div style={{
        background: tok.surface, border: `1px solid ${tok.border}`,
        borderRadius: 16, padding: '48px 24px', boxShadow: tok.shadow1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 12, color: tok.textMuted,
      }}>
        loading devices…
      </div>
    );
  }

  return (
    <div style={{
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '20px 24px', boxShadow: tok.shadow1,
    }}>
      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted, marginBottom: 16 }}>
        Trusted Devices
      </div>

      {!isMobile && devices.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: TABLE_COLS,
          gap: 12, padding: '0 0 8px',
          borderBottom: `1px solid ${tok.border}`,
        }}>
          {['Device', 'Certificate CN', 'Status', 'First seen', 'Last seen', ''].map(h => (
            <div key={h} style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: tok.textDisabled }}>
              {h}
            </div>
          ))}
        </div>
      )}

      {devices.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: SANS, fontSize: 13, color: tok.textMuted }}>
          No trusted devices registered.
        </div>
      ) : (
        devices.map(device => (
          <DeviceRow
            key={device.cn}
            tok={tok}
            device={device}
            isMobile={isMobile}
            onRevoke={onRevoke}
            onDelete={onDelete}
          />
        ))
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 14, padding: '8px 10px',
        background: tok.accentSubtle, border: `1px solid ${tok.accentBorder}`, borderRadius: 9,
      }}>
        <Icon name="shield" size={13} color={tok.accent} />
        <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>
          Per-device certificate management — revoke any device independently without affecting others
        </span>
      </div>
    </div>
  );
}

function DevicesContent({ tok, dark }) {
  const [devices,      setDevices]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const width    = useWindowWidth();
  const isMobile = width < 768;

  useEffect(() => {
    fetch('/admin/devices')
      .then(r => r.json())
      .then(data => { setDevices(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleRevokeSuccess = () => {
    setDevices(prev => prev.map(d =>
      d.cn === revokeTarget.cn ? { ...d, revoked: true } : d
    ));
  };

  const handleDelete = (device) => {
    fetch(`/admin/devices/${encodeURIComponent(device.cn)}`, { method: 'DELETE' })
      .then(r => {
        if (r.ok || r.status === 204) {
          setDevices(prev => prev.filter(d => d.cn !== device.cn));
        }
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-up 200ms ease' }}>
      <AddDevicePanel tok={tok} dark={dark} />
      <DeviceListPanel
        tok={tok}
        isMobile={isMobile}
        devices={devices}
        loading={loading}
        onRevoke={d => setRevokeTarget(d)}
        onDelete={handleDelete}
      />
      {revokeTarget && (
        <RevokeModal
          tok={tok}
          device={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onSuccess={handleRevokeSuccess}
        />
      )}
    </div>
  );
}

Object.assign(window, { DevicesContent });
