const { useState, useEffect } = React;

const MOCK_DEVICES = [
  {
    id: 'dev-1',
    name: 'iPhone 15 Pro',
    platform: 'ios',
    cn: 'ombra-client-ios',
    status: 'active',
    added: '2026-01-14',
    expiry: '2027-01-14',
    daysLeft: 259,
    lastSeen: '2m ago',
  },
  {
    id: 'dev-2',
    name: 'MacBook Pro',
    platform: 'macos',
    cn: 'ombra-client-mac',
    status: 'active',
    added: '2026-02-03',
    expiry: '2027-02-03',
    daysLeft: 279,
    lastSeen: '8m ago',
  },
  {
    id: 'dev-3',
    name: 'iPad Air',
    platform: 'ios',
    cn: 'ombra-client-ipad',
    status: 'expiring',
    added: '2025-05-10',
    expiry: '2026-05-10',
    daysLeft: 10,
    lastSeen: '3h ago',
  },
];

function PlatformIcon({ platform, size = 16, color }) {
  if (platform === 'macos') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="13" rx="2"/>
        <path d="M2 19h20M9 19v2M15 19v2M9 21h6"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="3"/>
      <path d="M12 18h.01"/>
    </svg>
  );
}

function StatusBadge({ tok, status }) {
  const map = {
    active:   { text: 'Active',   color: tok.success,  bg: tok.successSubtle  },
    expiring: { text: 'Expiring', color: tok.warning,  bg: tok.warningSubtle  },
    revoked:  { text: 'Revoked',  color: tok.recording, bg: tok.recordingSubtle },
  };
  const s = map[status] || map.active;
  return (
    <div style={{
      fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
      color: s.color, background: s.bg,
      borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap',
    }}>{s.text}</div>
  );
}

function RevokeModal({ tok, device, onClose }) {
  const [typed, setTyped] = useState('');
  const inputRef = React.useRef(null);
  const matches = typed === device.name;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleConfirm = () => {
    if (!matches) return;
    onClose();
    // TODO: call revoke endpoint when per-device cert management is implemented
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
            <PlatformIcon platform={device.platform} size={18} color={tok.recording} />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: tok.textPrimary, lineHeight: 1.2 }}>
              Revoke access
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textMuted, marginTop: 5, lineHeight: 1.55 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: tok.textSecondary }}>{device.name}</span> will
              immediately lose access to Ombra. This cannot be undone.
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: tok.textSecondary, marginBottom: 8 }}>
            Type <span style={{ fontFamily: MONO, fontSize: 12, color: tok.recording }}>{device.name}</span> to confirm
          </div>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches) handleConfirm(); }}
            placeholder={device.name}
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
            Revoke access
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
  const qrColor = dark ? '#F0EDE8' : '#1C1917';
  const provisionUrl = 'ombra.local:8081/provision/certs';

  return (
    <div style={{
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '20px 24px', boxShadow: tok.shadow1,
      display: 'flex', gap: 24, alignItems: 'center',
    }}>
      <div style={{
        padding: 10, background: dark ? tok.surfaceElevated : '#fff',
        borderRadius: 12, border: `1px solid ${tok.borderSubtle}`, flexShrink: 0,
        lineHeight: 0,
      }}>
        <QRCode value={provisionUrl} size={120} color={qrColor} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted, marginBottom: 8 }}>
          Add Device
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13.5, color: tok.textPrimary, lineHeight: 1.55, marginBottom: 10 }}>
          Scan with the Ombra app to provision a new trusted device. The QR code contains a one-time token — it expires after first use.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontFamily: MONO, fontSize: 11.5, color: tok.accent,
            background: tok.accentSubtle, border: `1px solid ${tok.accentBorder}`,
            borderRadius: 8, padding: '5px 10px', letterSpacing: 0.3,
          }}>
            {provisionUrl}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>mTLS · scan to provision</div>
        </div>
      </div>
    </div>
  );
}

function DeviceRow({ tok, device, onRevoke, isMobile }) {
  const daysColor = device.daysLeft <= 14 ? tok.warning : tok.textMuted;

  if (isMobile) {
    return (
      <div style={{
        padding: '14px 0', borderBottom: `1px solid ${tok.borderSubtle}`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PlatformIcon platform={device.platform} size={15} color={tok.textSecondary} />
            <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 500, color: tok.textPrimary }}>{device.name}</span>
          </div>
          <StatusBadge tok={tok} status={device.status} />
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: tok.textMuted, letterSpacing: 0.2 }}>{device.cn}</span>
          <span style={{ fontFamily: SANS, fontSize: 11, color: daysColor }}>{device.daysLeft}d remaining</span>
          <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textDisabled }}>last seen {device.lastSeen}</span>
        </div>
        <button
          onClick={() => onRevoke(device)}
          style={{
            alignSelf: 'flex-start', fontFamily: SANS, fontSize: 11.5, fontWeight: 500,
            color: tok.recording, background: 'transparent',
            border: `1px solid ${tok.recording}44`, borderRadius: 8,
            padding: '5px 12px', cursor: 'pointer',
          }}
        >
          Revoke
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 160px 90px 90px 80px 80px',
      alignItems: 'center', gap: 12,
      padding: '13px 0',
      borderBottom: `1px solid ${tok.borderSubtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <PlatformIcon platform={device.platform} size={15} color={tok.textSecondary} />
        <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: tok.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {device.name}
        </span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted, letterSpacing: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {device.cn}
      </span>
      <StatusBadge tok={tok} status={device.status} />
      <span style={{ fontFamily: MONO, fontSize: 11, color: daysColor, letterSpacing: 0.2 }}>
        {device.daysLeft}d
      </span>
      <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textDisabled }}>
        {device.lastSeen}
      </span>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onRevoke(device)}
          style={{
            fontFamily: SANS, fontSize: 11.5, fontWeight: 500,
            color: tok.recording, background: 'transparent',
            border: `1px solid ${tok.recording}44`, borderRadius: 8,
            padding: '5px 12px', cursor: 'pointer',
            transition: 'border-color 120ms, background 120ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = tok.recording; e.currentTarget.style.background = tok.recordingSubtle; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = `${tok.recording}44`; e.currentTarget.style.background = 'transparent'; }}
        >
          Revoke
        </button>
      </div>
    </div>
  );
}

function DeviceListPanel({ tok, isMobile, onRevoke }) {
  return (
    <div style={{
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '20px 24px', boxShadow: tok.shadow1,
    }}>
      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted, marginBottom: 16 }}>
        Trusted Devices
      </div>

      {!isMobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 160px 90px 90px 80px 80px',
          gap: 12, padding: '0 0 8px',
          borderBottom: `1px solid ${tok.border}`,
        }}>
          {['Device', 'Certificate CN', 'Status', 'Expiry', 'Last seen', ''].map(h => (
            <div key={h} style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: tok.textDisabled }}>
              {h}
            </div>
          ))}
        </div>
      )}

      {MOCK_DEVICES.map(device => (
        <DeviceRow
          key={device.id}
          tok={tok}
          device={device}
          isMobile={isMobile}
          onRevoke={onRevoke}
        />
      ))}

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
  const [revokeTarget, setRevokeTarget] = useState(null);
  const width    = useWindowWidth();
  const isMobile = width < 768;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-up 200ms ease' }}>

      <AddDevicePanel tok={tok} dark={dark} />

      <DeviceListPanel tok={tok} isMobile={isMobile} onRevoke={d => setRevokeTarget(d)} />

      {revokeTarget && (
        <RevokeModal tok={tok} device={revokeTarget} onClose={() => setRevokeTarget(null)} />
      )}

    </div>
  );
}

Object.assign(window, { DevicesContent });
