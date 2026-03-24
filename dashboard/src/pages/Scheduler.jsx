import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format, startOfWeek, addDays, isSameDay, isToday, isPast,
  formatDistanceToNowStrict,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, List, Clock, RefreshCw } from 'lucide-react';
import { getSchedules, getClients } from '@/lib/api.js';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function Scheduler() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [clientId, setClientId] = useState('all');
  const [view, setView]         = useState('calendar'); // 'calendar' | 'list'

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const { data: schedules = [], isLoading, refetch } = useQuery({
    queryKey: ['schedules', { days: 30, clientId }],
    queryFn: () => getSchedules({ days: 30, clientId: clientId !== 'all' ? clientId : undefined }),
    refetchInterval: 60_000,
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEventsForDay = (day) =>
    schedules.filter((s) => isSameDay(new Date(s.scheduled_at), day));

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday  = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Group list by date
  const byDate = schedules.reduce((acc, s) => {
    const key = format(new Date(s.scheduled_at), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1">
          <button
            onClick={() => setView('calendar')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              view === 'calendar'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              view === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="w-3.5 h-3.5" />
            Upcoming
          </button>
        </div>

        {/* Client filter */}
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Week nav (calendar only) */}
        {view === 'calendar' && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={prevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 px-3" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={nextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="font-mono text-xs text-muted-foreground ml-1">
              {format(weekStart, 'dd MMM')} – {format(addDays(weekStart, 6), 'dd MMM yyyy')}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {schedules.length} scheduled
          </Badge>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : view === 'calendar' ? (
        <CalendarView days={days} getEventsForDay={getEventsForDay} />
      ) : (
        <ListView byDate={byDate} schedules={schedules} />
      )}
    </div>
  );
}

/* ── Calendar view ─────────────────────────────────────────────────────────── */
function CalendarView({ days, getEventsForDay }) {
  return (
    <Card className="overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'px-3 py-3 text-center border-r border-border last:border-r-0',
                today && 'bg-primary/5'
              )}
            >
              <p className={cn(
                'text-[10px] font-semibold uppercase tracking-widest mb-1',
                today ? 'text-primary' : 'text-muted-foreground'
              )}>
                {format(day, 'EEE')}
              </p>
              <p className={cn(
                'font-mono text-2xl font-medium leading-none',
                today ? 'text-primary' : 'text-foreground'
              )}>
                {format(day, 'd')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Events grid */}
      <div className="grid grid-cols-7 min-h-[420px]">
        {days.map((day) => {
          const events = getEventsForDay(day);
          const today  = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'border-r border-border last:border-r-0 p-2 space-y-1.5',
                today && 'bg-primary/5'
              )}
            >
              {events.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center mt-6 opacity-40">—</p>
              ) : (
                events.map((s) => (
                  <ScheduleEventCard key={s.id} schedule={s} compact />
                ))
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── List / Upcoming view ──────────────────────────────────────────────────── */
function ListView({ byDate, schedules }) {
  if (schedules.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No upcoming posts"
        description="Scheduled posts in the next 30 days will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([dateKey, events]) => {
        const date = new Date(dateKey);
        return (
          <div key={dateKey}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                'flex items-center gap-2',
                isToday(date) && 'text-primary'
              )}>
                <span className={cn(
                  'font-mono text-sm font-semibold',
                  isToday(date) ? 'text-primary' : 'text-foreground'
                )}>
                  {isToday(date) ? 'Today' : format(date, 'EEE, dd MMM')}
                </span>
                {isToday(date) && (
                  <Badge className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20">
                    Today
                  </Badge>
                )}
              </div>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-mono">{events.length}</span>
            </div>

            {/* Events */}
            <div className="space-y-2 pl-1">
              {events.map((s) => (
                <ScheduleEventCard key={s.id} schedule={s} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Shared event card ─────────────────────────────────────────────────────── */
function ScheduleEventCard({ schedule: s, compact = false }) {
  const scheduled = new Date(s.scheduled_at);
  const past      = isPast(scheduled);

  if (compact) {
    return (
      <div className="rounded-md border border-border bg-card p-1.5 hover:border-primary/30 transition-colors cursor-default">
        <div className="flex items-center justify-between gap-1 mb-1">
          <PlatformBadge platform={s.platform} />
          <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
            {format(scheduled, 'HH:mm')}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground truncate leading-snug">
          {s.post_title || `Variant #${s.post_variant_id}`}
        </p>
        {s.client_name && (
          <p className="text-[9px] text-muted-foreground/50 truncate mt-0.5">{s.client_name}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors">
      {/* Time */}
      <div className="flex-shrink-0 text-center min-w-[44px]">
        <p className="font-mono text-sm font-semibold text-foreground">
          {format(scheduled, 'HH:mm')}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {past ? 'past' : formatDistanceToNowStrict(scheduled, { addSuffix: false })}
        </p>
      </div>

      <div className="w-px self-stretch bg-border flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground truncate">
          {s.post_title || `Variant #${s.post_variant_id}`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <PlatformBadge platform={s.platform} />
          {s.client_name && (
            <span className="text-xs text-muted-foreground">{s.client_name}</span>
          )}
          {s.content_type && (
            <span className="text-[10px] text-muted-foreground capitalize">{s.content_type}</span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={s.variant_status || s.schedule_status} />
      </div>
    </div>
  );
}
