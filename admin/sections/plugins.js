function PluginsContent({ tok }) {
  return (
    <SectionPlaceholder
      tok={tok}
      icon="puzzle"
      title="Plugins"
      description="Official integrations (Calendar, Notion, Obsidian, Slack) and community plugins from the registry. Install, configure, and manage the plugin host."
    />
  );
}

Object.assign(window, { PluginsContent });
