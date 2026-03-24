import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Zap, Settings } from 'lucide-react';
import { getClients, createClient, triggerPipeline } from '@/lib/api.js';
import { StatusBadge } from '@/components/ui/status-badge';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export default function Clients() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const supervised = clients.filter((c) => c.approval_mode === 'supervised');
  const auto = clients.filter((c) => c.approval_mode === 'auto');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div />
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Client</DialogTitle>
            </DialogHeader>
            <CreateClientForm
              onCreated={() => {
                qc.invalidateQueries({ queryKey: ['clients'] });
                setShowCreate(false);
              }}
              onCancel={() => setShowCreate(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-5">
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-2">{clients.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="supervised">
            Supervised
            <Badge variant="secondary" className="ml-2">{supervised.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="auto">
            Auto-publish
            <Badge variant="secondary" className="ml-2">{auto.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {[
          { value: 'all', list: clients },
          { value: 'supervised', list: supervised },
          { value: 'auto', list: auto },
        ].map(({ value, list }) => (
          <TabsContent key={value} value={value}>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-36 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No clients yet"
                description="Add your first client to start automating their content pipeline."
                action={
                  <Button onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add client
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {list.map((c) => (
                  <ClientCard
                    key={c.id}
                    client={c}
                    onView={() => navigate(`/clients/${c.id}`)}
                    onTrigger={() => triggerPipeline(c.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ClientCard({ client, onView, onTrigger }) {
  const platforms = client.active_platforms || [];

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 transition-colors"
      onClick={onView}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{client.name}</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">#{client.id}</p>
          </div>
          <StatusBadge status={client.approval_mode} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {platforms.map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>
        )}
        <Separator className="my-2" />
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); onView(); }}
          >
            <Settings className="w-3 h-3 mr-1" />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onTrigger(); }}
          >
            <Zap className="w-3 h-3 mr-1" />
            Run
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateClientForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [tone, setTone] = useState('');
  const [audience, setAudience] = useState('');
  const [freq, setFreq] = useState('daily');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      createClient({
        name,
        settings: {
          niche,
          tone_of_voice: tone,
          target_audience: audience,
          idea_frequency: freq,
        },
      }),
    onSuccess: onCreated,
    onError: (e) => setError(e.response?.data?.error || 'Failed to create client'),
  });

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="client-name">Client name *</Label>
        <Input
          id="client-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. FitnessPro"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="niche">Niche</Label>
        <Input
          id="niche"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. fitness coaching"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tone">Tone of voice</Label>
        <Input
          id="tone"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="e.g. motivational, direct"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audience">Target audience</Label>
        <Input
          id="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g. busy professionals aged 30-45"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Idea frequency</Label>
        <Select value={freq} onValueChange={setFreq}>
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
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => mutate()} disabled={!name || isPending}>
          {isPending ? 'Creating…' : 'Create client'}
        </Button>
      </DialogFooter>
    </div>
  );
}
