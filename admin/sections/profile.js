const { useState, useEffect, useRef } = React;

const MOCK_PROFILE = {
  name:             'Jackie Jensen',
  occupation:       'Software developer and entrepreneur',
  location:         'Denmark',
  important_people: 'My partner, close friends and collaborators',
  current_projects: 'Ombra — a privacy-first wearable second brain system',
  additional:       'Interested in Rust, embedded systems, AI and hardware projects',
  summary:          'Jackie is a software developer and entrepreneur based in Denmark, currently building Ombra — a privacy-first wearable system that acts as a personal second brain. They work closely with a tight circle of collaborators and are drawn to the intersection of embedded hardware, Rust, and applied AI.',
};

const FIELD_META = [
  { key: 'name',             label: 'Name',             hint: 'Your full name',                        multiline: false },
  { key: 'occupation',       label: 'Occupation',       hint: 'What you do for work',                  multiline: false },
  { key: 'location',         label: 'Location',         hint: 'Where you are based',                   multiline: false },
  { key: 'important_people', label: 'Important people', hint: 'People who matter in your life',        multiline: true  },
  { key: 'current_projects', label: 'Current projects', hint: 'What you are working on right now',     multiline: true  },
  { key: 'additional',       label: 'Additional',       hint: 'Anything else relevant about you',      multiline: true  },
];

function SummaryPanel({ tok, summary, onRegenerate, regenerating }) {
  return (
    <div style={{
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '20px 24px', boxShadow: tok.shadow1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted }}>
            AI Summary
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: tok.textDisabled }}>
            Injected as context on every query
          </div>
        </div>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: SANS, fontSize: 12, fontWeight: 500,
            color: regenerating ? tok.textDisabled : tok.accent,
            background: tok.accentSubtle, border: `1px solid ${tok.accentBorder}`,
            borderRadius: 9, padding: '7px 14px',
            cursor: regenerating ? 'default' : 'pointer',
            opacity: regenerating ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <Icon
            name="refresh"
            size={13}
            color={regenerating ? tok.textDisabled : tok.accent}
          />
          {regenerating ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>

      {summary ? (
        <div style={{
          borderLeft: `3px solid ${tok.accentBorder}`,
          paddingLeft: 18, margin: '4px 0',
        }}>
          <p style={{
            fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 400,
            fontSize: 17, lineHeight: 1.75, letterSpacing: 0.2,
            color: tok.textPrimary, margin: 0,
          }}>
            {summary}
          </p>
        </div>
      ) : (
        <div style={{
          fontFamily: SANS, fontSize: 13, color: tok.textMuted,
          padding: '16px 0', textAlign: 'center',
        }}>
          No summary yet — complete your profile and click Regenerate.
        </div>
      )}
    </div>
  );
}

function FieldInput({ tok, value, onChange, multiline, placeholder }) {
  const shared = {
    width: '100%', fontFamily: SANS, fontSize: 13, color: tok.textPrimary,
    background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
    borderRadius: 10, padding: '9px 14px', outline: 'none',
    resize: 'vertical', transition: 'border-color 120ms',
    lineHeight: 1.5,
  };

  const focusStyle  = e => e.target.style.borderColor = tok.accent;
  const blurStyle   = e => e.target.style.borderColor = tok.border;

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        onFocus={focusStyle}
        onBlur={blurStyle}
        style={{ ...shared, minHeight: 60 }}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={focusStyle}
      onBlur={blurStyle}
      style={{ ...shared }}
    />
  );
}

function ProfileFieldsPanel({ tok, isMobile }) {
  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [saved,   setSaved]     = useState(false);
  const [fields,  setFields]    = useState(MOCK_PROFILE);
  const [draft,   setDraft]     = useState(MOCK_PROFILE);

  const startEdit  = () => { setDraft(fields); setEditing(true); setSaved(false); };
  const cancelEdit = () => { setEditing(false); };

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600)); // TODO: PATCH /profile when endpoint exists
    setFields(draft);
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const setField = (key, val) => setDraft(d => ({ ...d, [key]: val }));

  const gridCols = isMobile ? '1fr' : '1fr 1fr';

  return (
    <div style={{
      background: tok.surface, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: '20px 24px', boxShadow: tok.shadow1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: tok.textMuted }}>
          Profile Fields
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && !editing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 12, color: tok.success }}>
              <Icon name="check" size={13} color={tok.success} strokeWidth={2.5} />
              Saved
            </div>
          )}
          {!editing ? (
            <button
              onClick={startEdit}
              style={{
                fontFamily: SANS, fontSize: 12.5, fontWeight: 500,
                color: tok.accent, background: tok.accentSubtle,
                border: `1px solid ${tok.accentBorder}`, borderRadius: 9,
                padding: '6px 14px', cursor: 'pointer',
              }}
            >
              Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={cancelEdit}
                style={{
                  fontFamily: SANS, fontSize: 12.5, fontWeight: 500,
                  color: tok.textSecondary, background: 'transparent',
                  border: `1px solid ${tok.border}`, borderRadius: 9,
                  padding: '6px 14px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  fontFamily: SANS, fontSize: 12.5, fontWeight: 500,
                  color: '#fff', background: tok.accent, border: 'none',
                  borderRadius: 9, padding: '6px 14px',
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.65 : 1,
                  transition: 'opacity 120ms',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 18 }}>
          {FIELD_META.map(f => (
            <div key={f.key} style={f.multiline && !isMobile ? { gridColumn: '1 / -1' } : {}}>
              <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 500, color: tok.textSecondary, marginBottom: 6 }}>
                {f.label}
                <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted, fontWeight: 400, marginLeft: 8 }}>{f.hint}</span>
              </div>
              <FieldInput
                tok={tok}
                value={draft[f.key] || ''}
                onChange={v => setField(f.key, v)}
                multiline={f.multiline}
                placeholder={f.hint}
              />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FIELD_META.map((f, i) => (
            <div
              key={f.key}
              style={{
                display: 'flex', gap: 16,
                padding: '10px 0',
                borderBottom: i < FIELD_META.length - 1 ? `1px solid ${tok.borderSubtle}` : 'none',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'baseline',
              }}
            >
              <div style={{
                fontFamily: SANS, fontSize: 12, color: tok.textMuted,
                flexShrink: 0, width: isMobile ? 'auto' : 160,
              }}>
                {f.label}
              </div>
              <div style={{
                fontFamily: SANS, fontSize: 13, color: fields[f.key] ? tok.textPrimary : tok.textDisabled,
                lineHeight: 1.5, flex: 1,
              }}>
                {fields[f.key] || '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 18, padding: '7px 11px',
        background: tok.accentSubtle, border: `1px solid ${tok.accentBorder}`, borderRadius: 9,
      }}>
        <Icon name="shield" size={13} color={tok.accent} />
        <span style={{ fontFamily: SANS, fontSize: 11, color: tok.textMuted }}>
          Fields are stored encrypted in SQLite and never leave your server
        </span>
      </div>
    </div>
  );
}

function ProfileContent({ tok }) {
  const [summary,      setSummary]      = useState(MOCK_PROFILE.summary);
  const [regenerating, setRegenerating] = useState(false);
  const width    = useWindowWidth();
  const isMobile = width < 768;

  const handleRegenerate = async () => {
    setRegenerating(true);
    await new Promise(r => setTimeout(r, 1800)); // TODO: POST /profile/regenerate when endpoint exists
    setRegenerating(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slide-up 200ms ease' }}>
      <SummaryPanel tok={tok} summary={summary} onRegenerate={handleRegenerate} regenerating={regenerating} />
      <ProfileFieldsPanel tok={tok} isMobile={isMobile} />
    </div>
  );
}

Object.assign(window, { ProfileContent });
