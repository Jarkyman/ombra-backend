function ProfileContent({ tok }) {
  return (
    <SectionPlaceholder
      tok={tok}
      icon="mic"
      title="User Profile"
      description="AI-generated Q&A pairs capturing your background, preferences, and context. This profile is injected into every query to ground the model in who you are."
    />
  );
}

Object.assign(window, { ProfileContent });
