import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const SETTINGS_ROWS = [
  { label: 'API version',        value: 'v4.1' },
  { label: 'Approval default',   value: 'supervised' },
  { label: 'Auto-upgrade after', value: '14 days' },
  { label: 'Stats fetch delay',  value: '24 hours' },
];

export default function SettingsPage() {
  return (
    <div className="max-w-lg space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">System Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-0">
            {SETTINGS_ROWS.map(({ label, value }, i) => (
              <div key={label}>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-foreground">{label}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {value}
                  </Badge>
                </div>
                {i < SETTINGS_ROWS.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            System settings are managed via environment variables in{' '}
            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border border-border">
              .env
            </code>
            . Changes to pipeline behavior, API keys, and defaults require a server restart.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
