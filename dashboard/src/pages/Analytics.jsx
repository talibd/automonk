import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BarChart2 } from 'lucide-react';
import { getClients, getClientStats, getClientStrategy } from '@/lib/api.js';
import { StatCard } from '@/components/ui/stat-card';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const DAY_OPTIONS = [7, 14, 30, 90];

export default function Analytics() {
  const [clientId, setClientId] = useState('');
  const [days, setDays] = useState(30);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['client-stats', clientId, days],
    queryFn: () => getClientStats(clientId, days),
    enabled: !!clientId,
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ['client-strategy', clientId],
    queryFn: () => getClientStrategy(clientId),
    enabled: !!clientId,
  });

  const t = data?.totals || {};
  const strategy = strategies[0];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select client…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          {DAY_OPTIONS.map((d) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              className="h-9"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {!clientId ? (
        <EmptyState
          icon={BarChart2}
          title="Select a client"
          description="Choose a client to view their analytics."
        />
      ) : (
        <div className="space-y-6">
          {/* Reach / Impressions / Likes / Comments */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label={`Reach (${days}d)`}
              value={t.reach?.toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label={`Impressions (${days}d)`}
              value={t.impressions?.toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label={`Likes (${days}d)`}
              value={t.likes?.toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label={`Comments (${days}d)`}
              value={t.comments?.toLocaleString()}
              loading={isLoading}
            />
          </div>

          {/* Shares / Saves / Views / Posts */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label={`Shares (${days}d)`}
              value={t.shares?.toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label={`Saves (${days}d)`}
              value={t.saves?.toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label={`Views (${days}d)`}
              value={t.views?.toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label={`Posts (${days}d)`}
              value={t.posts?.toLocaleString() ?? data?.top_posts?.length?.toString()}
              loading={isLoading}
            />
          </div>

          {/* Platform breakdown */}
          {(isLoading || data?.by_platform?.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Platform Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Posts</TableHead>
                      <TableHead className="text-right">Reach</TableHead>
                      <TableHead className="text-right">Likes</TableHead>
                      <TableHead className="text-right">Engagement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? [...Array(3)].map((_, i) => (
                          <TableRow key={i}>
                            {[...Array(5)].map((__, j) => (
                              <TableCell key={j}>
                                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : data?.by_platform?.map((row) => {
                          const engagement = row.reach > 0
                            ? (((row.likes || 0) + (row.comments || 0)) / row.reach * 100).toFixed(1)
                            : '—';
                          return (
                            <TableRow key={row.platform}>
                              <TableCell>
                                <PlatformBadge platform={row.platform} />
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {(row.posts || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {(row.reach || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {(row.likes || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {engagement !== '—' ? `${engagement}%` : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Strategy card */}
          {(isLoading || strategy) && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Strategy</CardTitle>
                  {strategy && (
                    <Badge variant="outline" className="font-mono text-xs">
                      v{strategy.version}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                  </div>
                ) : strategy ? (
                  <>
                    <p className="text-sm text-foreground leading-relaxed">
                      {strategy.strategy?.overall_strategy}
                    </p>

                    {strategy.strategy?.top_performing_themes?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Top themes
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {strategy.strategy.top_performing_themes.map((theme) => (
                            <Badge key={theme} variant="secondary">{theme}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {strategy.strategy?.content_recommendations && (
                      <div className="grid grid-cols-2 gap-4">
                        {strategy.strategy.content_recommendations.increase?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#22C55E] mb-2">
                              Do more
                            </p>
                            <ul className="space-y-1">
                              {strategy.strategy.content_recommendations.increase.map((item, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                  <span className="text-[#22C55E]">↑</span>{item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {strategy.strategy.content_recommendations.decrease?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-2">
                              Do less
                            </p>
                            <ul className="space-y-1">
                              {strategy.strategy.content_recommendations.decrease.map((item, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                  <span className="text-destructive">↓</span>{item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="font-mono text-xs text-muted-foreground">
                      Updated {format(new Date(strategy.created_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
