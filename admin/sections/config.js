function ConfigContent({ tok }) {
  return (
    <SectionPlaceholder
      tok={tok}
      icon="settings"
      title="Configuration"
      description="Server settings, DDNS configuration, mTLS certificate expiry and renewal, AppConfig form, and the danger zone with factory reset."
    />
  );
}

Object.assign(window, { ConfigContent });
