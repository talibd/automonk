import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Zap, Trash2, LayoutGrid, RefreshCw } from 'lucide-react';
import {
  getPosts, getClients, approvePost, rejectPost, deleteVariant, triggerPipeline,
} from '@/lib/api.js';
import { StatusBadge } from '@/components/ui/status-badge';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const STATUS_TABS = [
  { value: '',                 label: 'All' },
  { value: 'approval_pending', label: 'Pending' },
  { value: 'scheduled',        label: 'Scheduled' },
  { value: 'posted',           label: 'Posted' },
  { value: 'failed',           label: 'Failed' },
  { value: 'rejected',         label: 'Rejected' },
];

export default function Pipeline() {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('all');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['posts-pipeline', clientId, status, page],
    queryFn: () =>
      getPosts({
        clientId: clientId !== 'all' ? clientId : undefined,
        status:   status   || undefined,
        page,
        limit: 25,
      }),
    refetchInterval: 30_000,
  });

  const posts = data?.posts || [];
  const total = data?.total  || 0;

  const approveMut = useMutation({
    mutationFn: approvePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts-pipeline'] }),
  });

  const rejectMut = useMutation({
    mutationFn: rejectPost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts-pipeline'] }),
  });

  const deleteMut = useMutation({
    mutationFn: ({ postId, variantId }) => deleteVariant(postId, variantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts-pipeline'] }),
  });

  const handleStatusTab = (val) => { setStatus(val); setPage(1); };
  const handleClient    = (val) => { setClientId(val || 'all'); setPage(1); };

  return (
    <div className="space-y-6">

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Status tabs */}
        <div
          className="flex items-center gap-0.5 rounded-xl p-1"
          style={{ background: 'hsl(220,13%,17%)' }}
        >
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => handleStatusTab(t.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                status === t.value
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Client filter */}
        <Select value={clientId} onValueChange={handleClient}>
          <SelectTrigger className="w-44 h-9 text-[13px]">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {clientId !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-[12px]"
              onClick={() => triggerPipeline(parseInt(clientId))}
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Run Pipeline
            </Button>
          )}
          <Button
            size="sm"
            className="h-9 text-[12px]"
            onClick={() => navigate(`/carousel/new${clientId !== 'all' ? `?clientId=${clientId}` : ''}`)}
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
            New Carousel
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-[12px] text-muted-foreground font-mono -mt-2">
          {total} post{total !== 1 ? 's' : ''}
          {status ? ` · ${STATUS_TABS.find((t) => t.value === status)?.label}` : ''}
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-xl" style={{ background: 'hsl(220,13%,15%)' }} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No posts"
          description={
            status
              ? `No posts with status "${STATUS_TABS.find((t) => t.value === status)?.label}".`
              : 'No posts yet. Create a carousel or run the pipeline to generate content.'
          }
          action={
            <Button onClick={() => navigate('/carousel/new')}>
              <LayoutGrid className="w-4 h-4 mr-1.5" />
              New Carousel
            </Button>
          }
        />
      ) : (
        <>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid hsl(220,13%,20%)', background: 'hsl(220,13%,12%)' }}
          >
            <Table>
              <TableHeader>
                <TableRow style={{ borderBottom: '1px solid hsl(220,13%,20%)' }}>
                  <TableHead className="w-12 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">#</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Post</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Platforms</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Scheduled</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Client</TableHead>
                  <TableHead className="w-40 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => {
                  const variants     = (post.variants || []).filter(Boolean);
                  const title        = post.master_script?.title || `Post #${post.id}`;
                  const client       = clients.find((c) => c.id === post.client_id);
                  const nextScheduled = variants
                    .filter((v) => v.scheduled_at)
                    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0]
                    ?.scheduled_at;

                  return (
                    <TableRow
                      key={post.id}
                      className="min-h-[52px]"
                      style={{ borderBottom: '1px solid hsl(220,13%,17%)' }}
                    >
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        #{post.id}
                      </TableCell>

                      <TableCell className="max-w-[200px]">
                        <p className="text-[13px] font-medium text-foreground truncate">{title}</p>
                        <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(post.created_at), 'dd MMM yyyy')}
                        </p>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={post.status} />
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {variants.map((v) => (
                            <PlatformBadge key={v.id} platform={v.platform} />
                          ))}
                          {variants.length === 0 && (
                            <span className="text-[12px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-[12px] text-muted-foreground">
                        {nextScheduled
                          ? format(new Date(nextScheduled), 'dd MMM HH:mm')
                          : '—'}
                      </TableCell>

                      <TableCell className="text-[12px] text-muted-foreground">
                        {client?.name || `#${post.client_id}`}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {post.status === 'approval_pending' && (
                            <>
                              <button
                                onClick={() => approveMut.mutate(post.id)}
                                disabled={approveMut.isPending}
                                className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                                style={{ background: 'rgba(34,197,94,0.1)', color: 'rgb(74,222,128)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34,197,94,0.2)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => rejectMut.mutate(post.id)}
                                disabled={rejectMut.isPending}
                                className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                                style={{ background: 'rgba(239,68,68,0.1)', color: 'rgb(248,113,113)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {variants
                            .filter((v) => v.status === 'posted')
                            .map((v) => (
                              <AlertDialog key={v.id}>
                                <AlertDialogTrigger asChild>
                                  <button
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete variant?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Remove the <strong>{v.platform}</strong> post from the platform.
                                      Stats collected so far are retained.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        deleteMut.mutate({ postId: post.id, variantId: v.id })
                                      }
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
          </div>

          {/* Pagination */}
          {total > 25 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[12px]"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="font-mono text-[12px] text-muted-foreground">
                Page {page} of {Math.ceil(total / 25)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[12px]"
                onClick={() => setPage((p) => p + 1)}
                disabled={posts.length < 25}
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
