function TrashContent({ tok }) {
  return (
    <SectionPlaceholder
      tok={tok}
      icon="trash"
      title="Trash"
      description="Memory clusters flagged for deletion — either by you or by the AI during relevance review. Permanently delete or restore to the active pool."
    />
  );
}

Object.assign(window, { TrashContent });
