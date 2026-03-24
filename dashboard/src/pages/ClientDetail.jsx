import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Zap, Link2, GitBranch, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  getClient, updateClientSettings, triggerPipeline,
  getPosts, approvePost, rejectPost, deleteVariant,
  createPlatformConnectSession, createPlatformOAuthLink, getPlatformAccounts, upsertPlatformAccount, updatePlatformAccount, deletePlatformAccount,
  getClientStats, getClientStrategy,
} from '@/lib/api.js';
import { StatusBadge } from '@/components/ui/status-badge';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads', 'youtube'];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => getClient(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-72" />
      </div>
    );
  }

  if (!client) {
    return <p className="text-muted-foreground">Client not found</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('/clients')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">ID {id}</span>
            <StatusBadge status={client.approval_mode} />
            {(client.active_platforms || []).map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>
        </div>
        <Button onClick={() => triggerPipeline(id)}>
          <Zap className="w-4 h-4 mr-2" />
          Run pipeline
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab clientId={id} />
        </TabsContent>
        <TabsContent value="pipeline">
          <PipelineTab clientId={id} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab client={client} />
        </TabsContent>
        <TabsContent value="platforms">
          <ConnectionsTab clientId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ clientId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['client-stats', clientId],
    queryFn: () => getClientStats(clientId, 30),
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ['client-strategy', clientId],
    queryFn: () => getClientStrategy(clientId),
  });

  const t = data?.totals || {};
  const strategy = strategies[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Reach (30d)"       value={t.reach?.toLocaleString()}       loading={isLoading} />
        <StatCard label="Impressions (30d)" value={t.impressions?.toLocaleString()} loading={isLoading} />
        <StatCard label="Likes (30d)"       value={t.likes?.toLocaleString()}       loading={isLoading} />
        <StatCard label="Comments (30d)"    value={t.comments?.toLocaleString()}    loading={isLoading} />
      </div>

      {strategy && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Current Strategy</CardTitle>
              <Badge variant="outline" className="text-xs font-mono">v{strategy.version}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#22C55E] mb-2">Do more</p>
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-2">Do less</p>
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
              {format(new Date(strategy.created_at), 'dd MMM yyyy, HH:mm')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────

function PipelineTab({ clientId }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['posts', clientId, page, statusFilter],
    queryFn: () => getPosts({ clientId, page, limit: 20, status: statusFilter || undefined }),
  });

  const approveMut = useMutation({
    mutationFn: approvePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts', clientId] }),
  });

  const rejectMut = useMutation({
    mutationFn: rejectPost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts', clientId] }),
  });

  const deleteMut = useMutation({
    mutationFn: ({ postId, variantId }) => deleteVariant(postId, variantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts', clientId] }),
  });

  const posts = data?.posts || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="approval_pending">Pending approval</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="text-xs font-mono text-muted-foreground ml-auto">
            {data.total} posts
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No posts yet"
          description="Trigger the pipeline to generate the first post."
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => {
                  const variants = (post.variants || []).filter(Boolean);
                  const title = post.master_script?.title || post.ideas?.[0]?.title || '—';
                  return (
                    <TableRow key={post.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{post.id}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="text-sm font-medium text-foreground truncate">{title}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={post.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {variants.map((v) => v && (
                            <PlatformBadge key={v.id} platform={v.platform} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {format(new Date(post.created_at), 'dd MMM HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {post.status === 'approval_pending' && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => approveMut.mutate(post.id)}
                                disabled={approveMut.isPending}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => rejectMut.mutate(post.id)}
                                disabled={rejectMut.isPending}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {variants
                            .filter((v) => v.status === 'posted')
                            .map((v) => (
                              <AlertDialog key={v.id}>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 w-7 p-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete variant?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Delete the {v.platform} variant of post #{post.id}? This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMut.mutate({ postId: post.id, variantId: v.id })}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {data?.total > 20 && (
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span className="font-mono text-xs text-muted-foreground">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={posts.length < 20}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ client }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    niche:           client.niche            || '',
    tone_of_voice:   client.tone_of_voice    || '',
    target_audience: client.target_audience  || '',
    idea_frequency:  client.idea_frequency   || 'daily',
    approval_mode:   client.approval_mode    || 'supervised',
    weekly_optimization: client.weekly_optimization !== false,
    posting_times:   client.posting_times    || {},
    hashtag_sets:    client.hashtag_sets
      ? JSON.stringify(client.hashtag_sets, null, 2)
      : '',
    cta_preferences: client.cta_preferences
      ? JSON.stringify(client.cta_preferences, null, 2)
      : '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      let hashtag_sets = undefined;
      let cta_preferences = undefined;
      try {
        if (form.hashtag_sets.trim()) hashtag_sets = JSON.parse(form.hashtag_sets);
      } catch { throw new Error('Invalid JSON in hashtag sets'); }
      try {
        if (form.cta_preferences.trim()) cta_preferences = JSON.parse(form.cta_preferences);
      } catch { throw new Error('Invalid JSON in CTA preferences'); }

      return updateClientSettings(client.client_id || client.id, {
        niche: form.niche,
        tone_of_voice: form.tone_of_voice,
        target_audience: form.target_audience,
        idea_frequency: form.idea_frequency,
        approval_mode: form.approval_mode,
        weekly_optimization: form.weekly_optimization,
        posting_times: form.posting_times,
        hashtag_sets,
        cta_preferences,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', String(client.client_id || client.id)] });
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e) => setError(e.message || e.response?.data?.error || 'Failed to save'),
  });

  const postingPlatforms = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads', 'youtube'];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Content Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Content Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Niche</Label>
            <Input
              value={form.niche}
              onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
              placeholder="e.g. fitness coaching"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tone of voice</Label>
            <Input
              value={form.tone_of_voice}
              onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}
              placeholder="e.g. motivational, direct"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Target audience</Label>
            <Input
              value={form.target_audience}
              onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
              placeholder="e.g. busy professionals 30-45"
            />
          </div>
        </CardContent>
      </Card>

      {/* Automation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Idea frequency</Label>
            <Select
              value={form.idea_frequency}
              onValueChange={(v) => setForm((f) => ({ ...f, idea_frequency: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="every_2_days">Every 2 days</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Approval mode</Label>
            <Select
              value={form.approval_mode}
              onValueChange={(v) => setForm((f) => ({ ...f, approval_mode: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supervised">Supervised (manual approval)</SelectItem>
                <SelectItem value="auto">Auto-publish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-foreground">Weekly strategy optimization</p>
              <p className="text-xs text-muted-foreground">Auto-optimize content strategy weekly</p>
            </div>
            <Switch
              checked={form.weekly_optimization}
              onCheckedChange={(v) => setForm((f) => ({ ...f, weekly_optimization: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Posting times */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Posting Times</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {postingPlatforms.map((p) => (
            <div key={p} className="flex items-center gap-3">
              <div className="w-24 flex-shrink-0">
                <PlatformBadge platform={p} />
              </div>
              <Input
                type="time"
                value={form.posting_times[p] || ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    posting_times: { ...f.posting_times, [p]: e.target.value },
                  }))
                }
                className="w-32"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Advanced */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Advanced</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Hashtag sets (JSON)</Label>
            <Textarea
              value={form.hashtag_sets}
              onChange={(e) => setForm((f) => ({ ...f, hashtag_sets: e.target.value }))}
              placeholder='{"instagram": ["#fitness", "#motivation"]}'
              rows={4}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>CTA preferences (JSON)</Label>
            <Textarea
              value={form.cta_preferences}
              onChange={(e) => setForm((f) => ({ ...f, cta_preferences: e.target.value }))}
              placeholder='{"style": "question", "emoji": true}'
              rows={4}
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button onClick={() => mutate()} disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
      </Button>
    </div>
  );
}

// ── Connections Tab ───────────────────────────────────────────────────────────

function ConnectionsTab({ clientId }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['platform-accounts', clientId],
    queryFn: () => getPlatformAccounts(clientId),
  });

  const toggleMut = useMutation({
    mutationFn: ({ platform, active }) =>
      updatePlatformAccount(clientId, platform, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-accounts', clientId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (platform) => deletePlatformAccount(clientId, platform),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-accounts', clientId] }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}>
          <Link2 className="w-4 h-4 mr-2" />
          Connect platform
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No platforms connected"
          description="Connect your first platform to start publishing."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Account ID</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Token expiry</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => {
                const expiryDate = acc.token_expiry ? new Date(acc.token_expiry) : null;
                const daysLeft = expiryDate
                  ? Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24))
                  : null;
                const expiryColor =
                  daysLeft !== null && daysLeft < 7
                    ? 'text-destructive'
                    : 'text-muted-foreground';

                return (
                  <TableRow key={acc.id}>
                    <TableCell>
                      <PlatformBadge platform={acc.platform} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[160px] truncate">
                      {acc.account_id}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={acc.active}
                        onCheckedChange={(checked) =>
                          toggleMut.mutate({ platform: acc.platform, active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className={`font-mono text-xs ${expiryColor}`}>
                      {expiryDate
                        ? `${format(expiryDate, 'dd MMM yyyy')}${daysLeft < 7 ? ` (${daysLeft}d)` : ''}`
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setEditAccount(acc)}
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="h-7 text-xs">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete platform account?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove the {acc.platform} account from this client? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(acc.platform)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Platform</DialogTitle>
          </DialogHeader>
          <AccountForm
            clientId={clientId}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['platform-accounts', clientId] });
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editAccount} onOpenChange={(v) => !v && setEditAccount(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Platform Account</DialogTitle>
          </DialogHeader>
          {editAccount && (
            <AccountForm
              clientId={clientId}
              initialData={editAccount}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['platform-accounts', clientId] });
                setEditAccount(null);
              }}
              onCancel={() => setEditAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountForm({ clientId, initialData, onSaved, onCancel }) {
  const [form, setForm] = useState({
    platform:     initialData?.platform     || 'instagram',
    account_id:   initialData?.account_id   || '',
    access_token: '',
    token_expiry: initialData?.token_expiry
      ? new Date(initialData.token_expiry).toISOString().slice(0, 10)
      : '',
  });
  const [error, setError] = useState('');
  const connectMut = useMutation({
    mutationFn: () => createPlatformConnectSession(clientId, form.platform),
    onSuccess: (session) => {
      window.open(session.connect_link, '_blank', 'noopener,noreferrer');
      onSaved();
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to start Nango connection'),
  });
  const oauthMut = useMutation({
    mutationFn: () => createPlatformOAuthLink(clientId, form.platform),
    onSuccess: (payload) => {
      window.open(payload.url, '_blank', 'noopener,noreferrer');
      onSaved();
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to start OAuth connection'),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      upsertPlatformAccount(clientId, {
        platform:     form.platform,
        account_id:   form.account_id,
        access_token: form.access_token || undefined,
        token_expiry: form.token_expiry || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.error || 'Failed to save account'),
  });

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Platform</Label>
        <Select
          value={form.platform}
          onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}
          disabled={!!initialData}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!initialData && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-sm font-medium text-foreground">Connect with Nango</p>
          <p className="text-xs text-muted-foreground">
            Use the hosted OAuth flow when the platform supports it. AutoMonk saves the connection automatically after authorization.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => connectMut.mutate()}
            disabled={connectMut.isPending}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {connectMut.isPending ? 'Opening…' : 'Open Nango Connect'}
          </Button>
        </div>
      )}
      {form.platform === 'instagram' && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-sm font-medium text-foreground">Connect with Facebook (Recommended)</p>
          <p className="text-xs text-muted-foreground">
            Use the Meta auth link first. AutoMonk will verify the available Instagram account after login.
          </p>
          {!initialData && (
            <Button
              type="button"
              variant="outline"
              onClick={() => oauthMut.mutate()}
              disabled={oauthMut.isPending}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {oauthMut.isPending ? 'Opening…' : 'Connect with Facebook'}
            </Button>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Account / Page ID</Label>
        <Input
          value={form.account_id}
          onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
          placeholder="Numeric ID or URN"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Access token</Label>
        <Textarea
          value={form.access_token}
          onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
          placeholder={initialData ? 'Leave blank to keep existing token' : 'Paste the access token…'}
          rows={3}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Token expiry (optional)</Label>
        <Input
          type="date"
          value={form.token_expiry}
          onChange={(e) => setForm((f) => ({ ...f, token_expiry: e.target.value }))}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => mutate()}
          disabled={!form.account_id || isPending}
        >
          {isPending ? 'Saving…' : initialData ? 'Save changes' : 'Connect'}
        </Button>
      </DialogFooter>
    </div>
  );
}
