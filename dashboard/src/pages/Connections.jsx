import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { ExternalLink, Link2, Plus } from 'lucide-react';
import {
  getClients, getPlatformAccounts,
  createPlatformConnectSession, createPlatformOAuthLink, upsertPlatformAccount, updatePlatformAccount, deletePlatformAccount,
} from '@/lib/api.js';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads', 'youtube'];

export default function Connections() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [addClientId, setAddClientId] = useState('');

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => { setAddClientId(''); setShowAdd(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Connect platform
        </Button>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No clients"
          description="Create a client first, then connect their platforms."
        />
      ) : (
        <div className="space-y-5">
          {clients.map((c) => (
            <ClientAccountsSection
              key={c.id}
              client={c}
              onAdd={() => { setAddClientId(String(c.id)); setShowAdd(true); }}
            />
          ))}
        </div>
      )}

      {/* Add account dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Platform</DialogTitle>
          </DialogHeader>
          <AddAccountForm
            clients={clients}
            defaultClientId={addClientId}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['platform-accounts'] });
              setShowAdd(false);
              setAddClientId('');
            }}
            onCancel={() => { setShowAdd(false); setAddClientId(''); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientAccountsSection({ client, onAdd }) {
  const qc = useQueryClient();
  const [editAccount, setEditAccount] = useState(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['platform-accounts', String(client.id)],
    queryFn: () => getPlatformAccounts(client.id),
  });

  const toggleMut = useMutation({
    mutationFn: ({ platform, active }) =>
      updatePlatformAccount(client.id, platform, { active }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['platform-accounts', String(client.id)] }),
  });

  const deleteMut = useMutation({
    mutationFn: (platform) => deletePlatformAccount(client.id, platform),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['platform-accounts', String(client.id)] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground">{client.name}</h2>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">No platforms connected</p>
          </CardContent>
        </Card>
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
                  ? differenceInDays(expiryDate, new Date())
                  : null;
                const isExpiringSoon = daysLeft !== null && daysLeft < 7;

                return (
                  <TableRow key={acc.id}>
                    <TableCell>
                      <PlatformBadge platform={acc.platform} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[180px] truncate">
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
                    <TableCell>
                      {acc.nango_connection_id ? (
                        <Badge variant="outline" className="font-mono text-[10px]">Nango managed</Badge>
                      ) : expiryDate ? (
                        <span
                          className={cn(
                            'font-mono text-xs',
                            isExpiringSoon ? 'text-destructive' : 'text-muted-foreground'
                          )}
                        >
                          {format(expiryDate, 'dd MMM yyyy')}
                          {daysLeft < 0
                            ? ' (expired)'
                            : isExpiringSoon
                            ? ` (${daysLeft}d)`
                            : ''}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
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
                                Remove the {acc.platform} account ({acc.account_id}) from {client.name}?
                                This cannot be undone.
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

      {/* Edit dialog */}
      <Dialog open={!!editAccount} onOpenChange={(v) => !v && setEditAccount(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Platform Account</DialogTitle>
          </DialogHeader>
          {editAccount && (
            <EditAccountForm
              clientId={client.id}
              account={editAccount}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['platform-accounts', String(client.id)] });
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

function AddAccountForm({ clients, defaultClientId, onSaved, onCancel }) {
  const [form, setForm] = useState({
    clientId:      defaultClientId || '',
    platform:      'instagram',
    account_id:    '',
    access_token:  '',
    refresh_token: '',
    token_expiry:  '',
    template_path: '',
  });
  const [error, setError] = useState('');
  const connectMut = useMutation({
    mutationFn: () => createPlatformConnectSession(form.clientId, form.platform),
    onSuccess: (session) => {
      window.open(session.connect_link, '_blank', 'noopener,noreferrer');
      onSaved();
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to start Nango connection'),
  });
  const oauthMut = useMutation({
    mutationFn: () => createPlatformOAuthLink(form.clientId, form.platform),
    onSuccess: (payload) => {
      window.open(payload.url, '_blank', 'noopener,noreferrer');
      onSaved();
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to start OAuth connection'),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      upsertPlatformAccount(form.clientId, {
        platform:      form.platform,
        account_id:    form.account_id,
        access_token:  form.access_token,
        refresh_token: form.refresh_token || undefined,
        token_expiry:  form.token_expiry  || undefined,
        template_path: form.template_path || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.error || 'Failed to connect'),
  });

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Client</Label>
        <Select
          value={form.clientId}
          onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select client…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Platform</Label>
        <Select
          value={form.platform}
          onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}
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
      {form.platform === 'instagram' && (
        <Card className="border-dashed">
          <CardContent className="py-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Connect with Facebook (Recommended)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the Meta auth link instead of pasting tokens. AutoMonk will verify the available Instagram account after login.
              </p>
            </div>
            <Button
              onClick={() => oauthMut.mutate()}
              disabled={!form.clientId || oauthMut.isPending}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {oauthMut.isPending ? 'Opening…' : 'Connect with Facebook'}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Use manual token entry only if Meta auth is unavailable for your app.
            </p>
          </CardContent>
        </Card>
      )}
      <Card className="border-dashed">
        <CardContent className="py-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Connect with Nango</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start the hosted OAuth flow for this platform. AutoMonk stores the connection when Nango completes the authorization.
            </p>
          </div>
          <Button
            onClick={() => connectMut.mutate()}
            disabled={!form.clientId || connectMut.isPending}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {connectMut.isPending ? 'Opening…' : 'Connect with Nango'}
          </Button>
        </CardContent>
      </Card>
      <div className="pt-2 border-t border-border" />
      <p className="text-xs font-medium text-muted-foreground">
        {form.platform === 'instagram' ? 'Instagram access token' : 'Manual fallback'}
      </p>
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
          placeholder="Paste access token…"
          rows={3}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Refresh token (optional)</Label>
        <Input
          value={form.refresh_token}
          onChange={(e) => setForm((f) => ({ ...f, refresh_token: e.target.value }))}
          placeholder="Optional"
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
      <div className="space-y-1.5">
        <Label>Template path (optional)</Label>
        <Input
          value={form.template_path}
          onChange={(e) => setForm((f) => ({ ...f, template_path: e.target.value }))}
          placeholder="clients/1/template.html"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => mutate()}
          disabled={!form.clientId || !form.account_id || !form.access_token || isPending}
        >
          {isPending ? 'Connecting…' : 'Connect'}
        </Button>
      </DialogFooter>
    </div>
  );
}

function EditAccountForm({ clientId, account, onSaved, onCancel }) {
  const [form, setForm] = useState({
    account_id:    account.account_id    || '',
    access_token:  '',
    refresh_token: '',
    token_expiry:  account.token_expiry
      ? new Date(account.token_expiry).toISOString().slice(0, 10)
      : '',
    template_path: account.template_path || '',
  });
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updatePlatformAccount(clientId, account.platform, {
        account_id:    form.account_id,
        access_token:  form.access_token  || undefined,
        refresh_token: form.refresh_token || undefined,
        token_expiry:  form.token_expiry  || undefined,
        template_path: form.template_path || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.error || 'Failed to save'),
  });

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Platform</Label>
        <div className="pt-1">
          <PlatformBadge platform={account.platform} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Account / Page ID</Label>
        <Input
          value={form.account_id}
          onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
          placeholder="Numeric ID or URN"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Access token (leave blank to keep existing)</Label>
        <Textarea
          value={form.access_token}
          onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
          placeholder="Paste new token to replace…"
          rows={3}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Refresh token (optional)</Label>
        <Input
          value={form.refresh_token}
          onChange={(e) => setForm((f) => ({ ...f, refresh_token: e.target.value }))}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Token expiry</Label>
        <Input
          type="date"
          value={form.token_expiry}
          onChange={(e) => setForm((f) => ({ ...f, token_expiry: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Template path</Label>
        <Input
          value={form.template_path}
          onChange={(e) => setForm((f) => ({ ...f, template_path: e.target.value }))}
          placeholder="clients/1/template.html"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => mutate()} disabled={!form.account_id || isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </div>
  );
}
