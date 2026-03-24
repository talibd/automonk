import { cn } from '@/lib/utils';

const STATUS_MAP = {
  // green solid
  posted:          'bg-green-500/10 text-green-400 border-green-500/20',
  success:         'bg-green-500/10 text-green-400 border-green-500/20',
  connected:       'bg-green-500/10 text-green-400 border-green-500/20',
  active:          'bg-green-500/10 text-green-400 border-green-500/20',
  // yellow/amber
  approval_pending:'bg-amber-500/10 text-amber-400 border-amber-500/20',
  pending:         'bg-amber-500/10 text-amber-400 border-amber-500/20',
  expiring_soon:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  // blue
  scheduled:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  // red
  failed:          'bg-red-500/10 text-red-400 border-red-500/20',
  rejected:        'bg-red-500/10 text-red-400 border-red-500/20',
  expired:         'bg-red-500/10 text-red-400 border-red-500/20',
  disconnected:    'bg-red-500/10 text-red-400 border-red-500/20',
  inactive:        'bg-red-500/10 text-red-400 border-red-500/20',
  // gray
  draft:           'bg-muted text-muted-foreground border-border',
  // green outline
  auto:            'bg-transparent text-green-400 border-green-500/40',
  // orange outline
  supervised:      'bg-transparent text-orange-400 border-orange-500/40',
};

const STATUS_LABELS = {
  approval_pending: 'Pending',
  expiring_soon:    'Expiring',
  disconnected:     'Disconnected',
  connected:        'Connected',
};

export function StatusBadge({ status }) {
  const style = STATUS_MAP[status?.toLowerCase()] || 'bg-muted text-muted-foreground border-border';
  const label = STATUS_LABELS[status?.toLowerCase()] || status;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
        style
      )}
    >
      {label}
    </span>
  );
}
