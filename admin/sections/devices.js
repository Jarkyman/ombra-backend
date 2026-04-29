function DevicesContent({ tok }) {
  return (
    <SectionPlaceholder
      tok={tok}
      icon="bluetooth"
      title="Devices"
      description="All trusted mTLS client certificates. View certificate CN, issue date, expiry, and last seen. Revoke access to remove a device immediately."
    />
  );
}

Object.assign(window, { DevicesContent });
