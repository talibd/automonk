export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 bg-bg-elevated border border-dashed border-border rounded-card text-center">
      {Icon && <Icon size={32} className="text-text-muted mb-4" />}
      <p className="text-[13px] font-medium text-text-primary mb-1">{title}</p>
      {description && (
        <p className="text-[12px] text-text-muted max-w-[280px] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
