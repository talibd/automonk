import { cn } from '@/lib/utils';

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('py-20 flex flex-col items-center text-center', className)}>
      {Icon && (
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'hsl(220,13%,17%)' }}
        >
          <Icon
            className="w-5 h-5 text-muted-foreground"
            strokeWidth={1.5}
          />
        </div>
      )}
      <p className="text-[13px] font-semibold text-foreground mb-1.5">
        {title}
      </p>
      {description && (
        <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}
