export function StatCard({ label, value, change, sub, loading }) {
  if (loading) {
    return (
      <div className="bg-bg-elevated border border-border rounded-card p-5">
        <div className="skeleton h-2.5 w-20 mb-3" />
        <div className="skeleton h-8 w-24 mb-2" />
        <div className="skeleton h-2 w-16" />
      </div>
    );
  }

  const changeColor =
    change > 0 ? 'text-status-success' : change < 0 ? 'text-status-error' : 'text-text-muted';
  const changeIcon = change > 0 ? '↑' : change < 0 ? '↓' : '—';

  return (
    <div className="bg-bg-elevated border border-border rounded-card p-5 fade-up">
      <p className="text-[10px] font-semibold uppercase tracking-[1px] text-text-muted mb-2">
        {label}
      </p>
      <p className="font-mono text-[28px] font-medium text-text-primary leading-none mb-2 tracking-tight">
        {value ?? '—'}
      </p>
      {(change !== undefined || sub) && (
        <p className={`text-[11px] font-mono ${changeColor}`}>
          {change !== undefined && `${changeIcon} ${Math.abs(change)}% vs last week`}
          {sub && <span className="text-text-muted ml-1">{sub}</span>}
        </p>
      )}
    </div>
  );
}
