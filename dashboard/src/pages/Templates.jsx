import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const SAMPLE_NAME = 'AutoMonk';
const SAMPLE_INITIALS = 'AM';

const TEMPLATES = [
  {
    id: 'tweet-style',
    name: 'Tweet Style',
    description: 'Light gray · profile header · verified badge',
    preview: (
      <div style={{ background: '#E8EAE8', width: '100%', aspectRatio: '1', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: '#1D9BF0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{SAMPLE_INITIALS}</div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#0F1419', display: 'flex', alignItems: 'center', gap: 3 }}>
              {SAMPLE_NAME}
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1D9BF0', borderRadius: '50%', width: 10, height: 10, color: '#fff', fontSize: 7 }}>✓</span>
            </div>
            <div style={{ fontSize: 7, color: '#536471' }}>Just now</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#0F1419', lineHeight: 1.4 }}>Consistency beats motivation every single time.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <span style={{ background: '#0F1419', color: '#fff', borderRadius: 100, padding: '3px 10px', fontSize: 8, fontWeight: 600 }}>👇 Read caption</span>
        </div>
      </div>
    ),
  },
  {
    id: 'dark-minimal',
    name: 'Dark Minimal',
    description: 'Dark navy · indigo accent · clean typography',
    preview: (
      <div style={{ background: '#0D1117', width: '100%', aspectRatio: '1', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 6 }}>
        <div style={{ width: 20, height: 3, background: '#6366F1', borderRadius: 2, marginBottom: 10 }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#FFFFFF', lineHeight: 1.4 }}>Consistency beats motivation every single time.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 6, fontWeight: 700, flexShrink: 0 }}>{SAMPLE_INITIALS}</div>
          <div style={{ fontSize: 8, color: '#8B949E', fontWeight: 500 }}>{SAMPLE_NAME}</div>
        </div>
      </div>
    ),
  },
  {
    id: 'gradient-vivid',
    name: 'Gradient Vivid',
    description: 'Purple → blue gradient · energetic · modern',
    preview: (
      <div style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#2563EB 100%)', width: '100%', aspectRatio: '1', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 6, fontWeight: 700 }}>{SAMPLE_INITIALS}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{SAMPLE_NAME}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 100, padding: '2px 7px', fontSize: 7, color: '#fff', fontWeight: 600 }}>1 of 5</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#FFFFFF', lineHeight: 1.4 }}>Consistency beats motivation every single time.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ width: i === 0 ? 12 : 5, height: 4, borderRadius: 2, background: i === 0 ? '#fff' : 'rgba(255,255,255,0.35)' }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'clean-light',
    name: 'Clean Light',
    description: 'White · orange accent border · elegant quote',
    preview: (
      <div style={{ background: '#FFFFFF', width: '100%', aspectRatio: '1', display: 'flex', flexDirection: 'row', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: 5, background: '#F97316', flexShrink: 0 }} />
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <div style={{ fontSize: 8, color: '#F97316', fontWeight: 700 }}>1 / 5</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 18, color: '#F97316', lineHeight: 0.8, fontWeight: 700, marginBottom: 4 }}>&ldquo;</div>
            <div style={{ fontSize: 10, color: '#111827', lineHeight: 1.4 }}>Consistency beats motivation every single time.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, borderTop: '1px solid #F3F4F6', paddingTop: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 5, fontWeight: 700 }}>{SAMPLE_INITIALS}</div>
            <div style={{ fontSize: 8, color: '#374151', fontWeight: 600 }}>{SAMPLE_NAME}</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'bold-solid',
    name: 'Bold Solid',
    description: 'Deep red · white text · big number watermark',
    preview: (
      <div style={{ background: '#DC2626', width: '100%', aspectRatio: '1', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: -8, right: 6, fontSize: 60, fontWeight: 800, color: 'rgba(255,255,255,0.1)', lineHeight: 1 }}>1</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 6, fontWeight: 700 }}>{SAMPLE_INITIALS}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{SAMPLE_NAME}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#FFFFFF', lineHeight: 1.4 }}>Consistency beats motivation every single time.</div>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === 0 ? '#fff' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
      </div>
    ),
  },
];

export default function Templates() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">Carousel Templates</h2>
        <p className="text-sm text-muted-foreground">
          These templates are used when rendering carousel slides. Select a template in the New Carousel wizard.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {TEMPLATES.map((t) => (
          <Card key={t.id} className="overflow-hidden">
            {/* CSS preview */}
            <div className="w-full p-0">
              {t.preview}
            </div>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
              <CardDescription className="text-xs leading-snug">{t.description}</CardDescription>
            </CardHeader>
            <Separator />
            <CardFooter className="px-3 py-2">
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Coming soon — upload via API
              </Badge>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground">
            Custom template upload is not yet implemented in the UI. Templates are currently
            assigned to clients via the Platforms configuration using the{' '}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">template_path</code> field.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
