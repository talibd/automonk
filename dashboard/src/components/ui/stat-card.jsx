import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function StatCard({ label, value, sub, icon: Icon, loading }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-5 pb-5">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-28 mb-2" />
          <Skeleton className="h-2.5 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {label}
            </p>
            <p className="font-mono text-3xl font-medium text-foreground leading-none mb-2 tracking-tight">
              {value ?? '—'}
            </p>
            {sub && (
              <p className="text-xs text-muted-foreground">{sub}</p>
            )}
          </div>
          {Icon && (
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 ml-3">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
