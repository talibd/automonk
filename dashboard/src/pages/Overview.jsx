import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, Users, ArrowRight } from 'lucide-react';
import {
  getOverviewStats, getSchedules, getPosts, approvePost, rejectPost,
} from '@/lib/api.js';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Overview() {
  const qc       = useQueryClient();
  const navigate = useNavigate();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['overview-stats'],
    queryFn: getOverviewStats,
    refetchInterval: 60_000,
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['schedules', { days: 1 }],
    queryFn: () => getSchedules({ days: 1 }),
    refetchInterval: 60_000,
  });

  const { data: pendingData } = useQuery({
    queryKey: ['posts', { status: 'approval_pending' }],
    queryFn: () => getPosts({ status: 'approval_pending', limit: 8 }),
    refetchInterval: 60_000,
  });

  const approveMut = useMutation({
    mutationFn: approvePost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['overview-stats'] });
    },
  });

  const rejectMut = useMutation({
    mutationFn: rejectPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['overview-stats'] });
    },
  });

  const pending = pendingData?.posts || [];

  return (
    <div className="space-y-6 max-w-[1280px]">

      {/* Row 1: Hero + Client portrait cards */}
      <div style={{ display: 'flex', gap: 20, height: 210 }}>

        {/* Hero card */}
        <div
          className="flex-1 rounded-2xl p-8 flex flex-col justify-between overflow-hidden"
          style={{ background: 'linear-gradient(140deg, #271404 0%, #160b03 100%)' }}
        >
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-4"
              style={{ color: 'hsl(24,94%,53%)' }}
            >
              This week
            </p>
            {loadingStats ? (
              <>
                <Skeleton className="h-10 w-48 mb-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <Skeleton className="h-4 w-64" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </>
            ) : (
              <>
                <h1 className="text-[38px] font-bold text-white leading-[1.1]">
                  {stats?.posts_this_week ?? 0} posts published
                </h1>
                <p className="text-[12px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {stats?.success_rate ?? 0}% success rate · {stats?.pending_approval ?? 0} pending
                </p>
              </>
            )}
          </div>
          <Button
            onClick={() => navigate('/pipeline')}
            className="w-fit rounded-full text-white text-[12px] gap-2 px-5 h-9"
            style={{ background: 'hsl(24,94%,53%)' }}
          >
            View Pipeline
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Client portrait cards */}
        <div className="flex gap-3 overflow-x-auto flex-shrink-0">
          {loadingStats
            ? [...Array(3)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-[120px] flex-shrink-0 h-full rounded-2xl"
                  style={{ background: 'hsl(220,13%,15%)' }}
                />
              ))
            : (stats?.clients || []).slice(0, 4).map((c, i) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  index={i}
                  onClick={() => navigate(`/clients/${c.id}`)}
                />
              ))}
        </div>
      </div>

      {/* Row 2: Stats 4-col */}
      <div className="grid grid-cols-4 gap-6">
        <StatTile
          label="Active Clients"
          value={stats?.total_clients}
          loading={loadingStats}
        />
        <StatTile
          label="Posts This Week"
          value={stats?.posts_this_week}
          loading={loadingStats}
        />
        <StatTile
          label="Success Rate"
          value={stats ? `${stats.success_rate}%` : undefined}
          loading={loadingStats}
          accent
        />
        <StatTile
          label="Pending Approval"
          value={stats?.pending_approval}
          loading={loadingStats}
        />
      </div>

      {/* Row 3: 2-col */}
      <div className="grid grid-cols-2 gap-6">

        {/* Pending Approval */}
        <div className="rounded-2xl p-6" style={{ background: 'hsl(220,13%,12%)' }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-[14px] font-semibold text-foreground">Pending Approval</p>
            {pending.length > 0 && (
              <span
                className="text-[11px] font-mono px-2.5 py-0.5 rounded-full"
                style={{ background: 'hsl(24,94%,53%,0.1)', color: 'hsl(24,94%,53%)' }}
              >
                {pending.length}
              </span>
            )}
          </div>

          {pending.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="All caught up"
              description="No posts waiting for your approval."
            />
          ) : (
            <div className="space-y-2">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 p-3.5 rounded-xl"
                  style={{ background: 'hsl(220,13%,16%)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {p.master_script?.title || `Post #${p.id}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      Client #{p.client_id}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => approveMut.mutate(p.id)}
                      disabled={approveMut.isPending}
                      className="h-8 px-3 rounded-xl text-[12px] font-medium transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(34,197,94,0.1)', color: 'rgb(74,222,128)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34,197,94,0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectMut.mutate(p.id)}
                      disabled={rejectMut.isPending}
                      className="h-8 px-3 rounded-xl text-[12px] font-medium transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'rgb(248,113,113)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scheduled Today */}
        <div className="rounded-2xl p-6" style={{ background: 'hsl(220,13%,12%)' }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-[14px] font-semibold text-foreground">Scheduled Today</p>
            {schedules.length > 0 && (
              <button
                onClick={() => navigate('/scheduler')}
                className="text-[12px] text-primary hover:opacity-75 transition-opacity"
              >
                See all
              </button>
            )}
          </div>

          {loadingSchedules ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-[52px] rounded-xl" style={{ background: 'hsl(220,13%,16%)' }} />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nothing scheduled today"
              description="Posts scheduled for today will appear here."
            />
          ) : (
            <div className="space-y-2">
              {schedules.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3.5 rounded-xl"
                  style={{ background: 'hsl(220,13%,16%)' }}
                >
                  <div
                    className="w-0.5 h-8 rounded-full flex-shrink-0"
                    style={{ background: 'hsl(24,94%,53%)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {s.post_title || `Post #${s.post_variant_id}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">{s.client_name}</span>
                      <PlatformBadge platform={s.platform} />
                    </div>
                  </div>
                  <span className="font-mono text-[12px] text-muted-foreground flex-shrink-0">
                    {format(new Date(s.scheduled_at), 'HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ── Client portrait card ── */
function ClientCard({ client, index, onClick }) {
  const isAccent = index % 2 === 0;
  const platforms = client.active_platforms || [];

  return (
    <button
      onClick={onClick}
      className="w-[120px] flex-shrink-0 h-full rounded-2xl p-4 flex flex-col justify-between text-left transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
      style={
        isAccent
          ? { background: 'hsl(24,94%,53%)' }
          : {
              background: 'hsl(220,13%,15%)',
              border: '1px solid hsl(220,13%,20%)',
            }
      }
    >
      <div>
        <p
          className="text-[11px] font-bold mb-1.5"
          style={{ color: isAccent ? 'rgba(255,255,255,0.5)' : 'hsl(220,9%,50%)' }}
        >
          {String(index + 1).padStart(2, '0')}
        </p>
        <p
          className="text-[13px] font-bold leading-snug line-clamp-3"
          style={{ color: isAccent ? '#fff' : 'hsl(220,10%,96%)' }}
        >
          {client.name}
        </p>
      </div>
      <div className="mt-2 space-y-0.5">
        {platforms.slice(0, 2).map((p) => (
          <p
            key={p}
            className="text-[10px] capitalize"
            style={{ color: isAccent ? 'rgba(255,255,255,0.55)' : 'hsl(220,9%,50%)' }}
          >
            {p}
          </p>
        ))}
      </div>
    </button>
  );
}

/* ── Stat tile ── */
function StatTile({ label, value, loading, accent }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: 'hsl(220,13%,12%)' }}>
      <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground mb-3">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-8 w-24" style={{ background: 'hsl(220,13%,18%)' }} />
      ) : (
        <p
          className="font-mono text-[28px] font-semibold leading-none"
          style={{ color: accent ? 'hsl(24,94%,53%)' : 'hsl(220,10%,96%)' }}
        >
          {value ?? '—'}
        </p>
      )}
    </div>
  );
}
