import { cn } from '@/lib/utils';

const PLATFORM_STYLES = {
  instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  facebook:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  youtube:   'bg-red-500/10 text-red-400 border-red-500/20',
  linkedin:  'bg-blue-600/10 text-blue-500 border-blue-600/20',
  twitter:   'bg-muted text-muted-foreground border-border',
  threads:   'bg-muted text-muted-foreground border-border',
};

export function PlatformBadge({ platform }) {
  const style = PLATFORM_STYLES[platform?.toLowerCase()] || 'bg-muted text-muted-foreground border-border';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        style
      )}
    >
      {platform}
    </span>
  );
}
