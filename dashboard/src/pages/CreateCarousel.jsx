import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Check, Pencil, Zap,
  Instagram, Twitter, Linkedin, Facebook, LayoutGrid,
} from 'lucide-react';
import { getClients, previewCarousel, createManualCarousel } from '../lib/api.js';

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads'];
const PLATFORM_ICONS = {
  instagram: Instagram, twitter: Twitter, linkedin: Linkedin, facebook: Facebook, threads: LayoutGrid,
};
const SLIDE_COUNTS = ['3', '4', '5', '6', '7', '8', '10'];

// ─── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'tweet-style',
    name: 'Tweet Style',
    desc: 'Light gray · profile header · verified badge',
    preview: ({ name, initials }) => (
      <div style={{ background: '#E8EAE8', width: '100%', aspectRatio: '1', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: '#1D9BF0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#0F1419' }}>{name}</div>
            <div style={{ fontSize: 7, color: '#536471' }}>Just now</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#0F1419', lineHeight: 1.4 }}>Your quote text goes here...</div>
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
    desc: 'Dark navy · indigo accent · clean typography',
    preview: ({ name, initials }) => (
      <div style={{ background: '#0D1117', width: '100%', aspectRatio: '1', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 6 }}>
        <div style={{ width: 20, height: 3, background: '#6366F1', borderRadius: 2, marginBottom: 10 }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#FFFFFF', lineHeight: 1.4 }}>Your quote text goes here...</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 6, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
          <div style={{ fontSize: 8, color: '#8B949E', fontWeight: 500 }}>{name}</div>
        </div>
      </div>
    ),
  },
  {
    id: 'gradient-vivid',
    name: 'Gradient Vivid',
    desc: 'Purple → blue gradient · energetic · modern',
    preview: ({ name, initials }) => (
      <div style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#2563EB 100%)', width: '100%', aspectRatio: '1', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 6, fontWeight: 700 }}>{initials}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{name}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 100, padding: '2px 7px', fontSize: 7, color: '#fff', fontWeight: 600 }}>1 of 5</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#FFFFFF', lineHeight: 1.4 }}>Your quote text goes here...</div>
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
    desc: 'White · orange accent border · elegant quote',
    preview: ({ name, initials }) => (
      <div style={{ background: '#FFFFFF', width: '100%', aspectRatio: '1', display: 'flex', flexDirection: 'row', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: 5, background: '#F97316', flexShrink: 0 }} />
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <div style={{ fontSize: 8, color: '#F97316', fontWeight: 700 }}>1 / 5</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 18, color: '#F97316', lineHeight: 0.8, fontWeight: 700, marginBottom: 4 }}>&ldquo;</div>
            <div style={{ fontSize: 10, color: '#111827', lineHeight: 1.4 }}>Your quote text goes here...</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, borderTop: '1px solid #F3F4F6', paddingTop: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 5, fontWeight: 700 }}>{initials}</div>
            <div style={{ fontSize: 8, color: '#374151', fontWeight: 600 }}>{name}</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'bold-solid',
    name: 'Bold Solid',
    desc: 'Deep red · white text · big number watermark',
    preview: ({ name, initials }) => (
      <div style={{ background: '#DC2626', width: '100%', aspectRatio: '1', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: -8, right: 6, fontSize: 60, fontWeight: 800, color: 'rgba(255,255,255,0.1)', lineHeight: 1 }}>1</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 6, fontWeight: 700 }}>{initials}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{name}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#FFFFFF', lineHeight: 1.4 }}>Your quote text goes here...</div>
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

function localISO(d) {
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Configure', 'Edit Slides', 'Done'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'upcoming';
        return (
          <div key={i} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors ${
                state === 'done'    ? 'bg-accent text-white' :
                state === 'active'  ? 'bg-accent text-white ring-4 ring-accent/20' :
                                      'bg-bg-elevated border border-border text-text-muted'
              }`}>
                {state === 'done' ? <Check size={13} /> : i + 1}
              </div>
              <span className={`text-[13px] font-medium ${
                state === 'upcoming' ? 'text-text-muted' : 'text-text-primary'
              }`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-4 h-px w-16 transition-colors ${i < current ? 'bg-accent' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Template selector ────────────────────────────────────────────────────────
function TemplateSelector({ value, onChange, clientName }) {
  const displayName = clientName || 'AutoMonk';
  const initials = displayName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Template Style</label>
      <div className="grid grid-cols-5 gap-2">
        {TEMPLATES.map(t => {
          const isSelected = value === t.id;
          const Preview = t.preview;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`flex flex-col rounded-card border overflow-hidden transition-all text-left ${
                isSelected
                  ? 'border-accent ring-2 ring-accent/20'
                  : 'border-border hover:border-accent/50'
              }`}
            >
              {/* Mini preview */}
              <div className="w-full">
                <Preview name={displayName} initials={initials} />
              </div>
              {/* Label */}
              <div className={`px-2 py-1.5 ${isSelected ? 'bg-accent/5' : 'bg-bg-elevated'}`}>
                <div className={`text-[10px] font-semibold truncate ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                  {t.name}
                </div>
                <div className="text-[9px] text-text-muted leading-tight mt-0.5 truncate">{t.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slide preview card for step 1 ───────────────────────────────────────────
function SlideCard({ index, slide, onChange, clientName, templateId }) {
  const [editing, setEditing] = useState(false);
  const displayName = clientName || 'AutoMonk';
  const initials = displayName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const preview = slide.quote.replace(/\*\*([^*]+)\*\*/g, '$1');
  const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const Preview = tpl.preview;

  return (
    <div className="bg-bg-elevated border border-border rounded-card overflow-hidden flex flex-col group hover:border-accent/50 transition-colors">

      {/* Template preview */}
      <div className="w-full">
        <div style={{ position: 'relative' }}>
          <Preview name={displayName} initials={initials} />
          {/* Overlay the actual quote text */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center',
            padding: '30% 12px 12px',
          }}>
            <p style={{
              fontSize: 10, lineHeight: 1.4, wordBreak: 'break-word',
              color: ['dark-minimal','gradient-vivid','bold-solid'].includes(templateId) ? '#fff' : (templateId === 'clean-light' ? '#111827' : '#0F1419'),
            }}>
              {preview}
            </p>
          </div>
        </div>
      </div>

      {/* Edit area */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Slide {index + 1}
          </span>
          <button
            onClick={() => setEditing(e => !e)}
            className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
              editing ? 'text-accent' : 'text-text-muted hover:text-accent'
            }`}
          >
            <Pencil size={11} />
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <textarea
            value={slide.quote}
            onChange={e => onChange(e.target.value)}
            autoFocus
            rows={5}
            className="w-full p-2.5 bg-bg-base border border-accent rounded-[6px] text-[12px] text-text-primary resize-none focus:outline-none leading-relaxed"
            placeholder="Quote text — use **word** for bold emphasis"
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            className="text-[12px] text-text-secondary leading-relaxed cursor-text hover:text-text-primary transition-colors"
          >
            {slide.quote}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CreateCarousel() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdPostId, setCreatedPostId] = useState(null);

  // Step 0 form state
  const [form, setForm] = useState({
    clientId: params.get('clientId') || '',
    topic: '',
    slideCount: '5',
    platforms: [],
    scheduledAt: localISO(new Date(Date.now() + 60 * 60 * 1000)),
    templateName: 'tweet-style',
  });

  // Step 1 slides state
  const [slides, setSlides] = useState([]);
  const [selectedClientName, setSelectedClientName] = useState('');

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: getClients });

  useEffect(() => {
    const client = clients.find(c => String(c.id) === String(form.clientId));
    setSelectedClientName(client?.name || '');
  }, [form.clientId, clients]);

  const togglePlatform = p =>
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));

  // ── Step 0 → Step 1: generate slides ──────────────────────────────────────
  const handleGenerate = async () => {
    setError('');
    if (!form.clientId)          return setError('Select a client.');
    if (!form.topic.trim())      return setError('Enter a topic.');
    if (!form.platforms.length)  return setError('Select at least one platform.');
    if (!form.scheduledAt)       return setError('Set a schedule time.');
    if (new Date(form.scheduledAt) <= new Date()) return setError('Schedule must be in the future.');

    setLoading(true);
    try {
      const { slides: gen } = await previewCarousel({
        topic: form.topic.trim(),
        slideCount: parseInt(form.slideCount, 10),
        clientId: parseInt(form.clientId),
      });
      setSlides(gen);
      setStep(1);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to generate slides.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1 → Step 2: schedule carousel ────────────────────────────────────
  const handleSchedule = async () => {
    setError('');
    setLoading(true);
    try {
      const { postId } = await createManualCarousel({
        clientId: parseInt(form.clientId),
        topic: form.topic.trim(),
        slideCount: slides.length,
        platforms: form.platforms,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        slides,
        templateName: form.templateName,
      });
      setCreatedPostId(postId);
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to schedule carousel.');
    } finally {
      setLoading(false);
    }
  };

  const updateSlide = (i, quote) =>
    setSlides(s => s.map((sl, idx) => idx === i ? { ...sl, quote } : sl));

  // ── Step 2: Done ───────────────────────────────────────────────────────────
  if (step === 2) return (
    <div className="fade-up max-w-lg mx-auto mt-16 text-center">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
        <Check size={28} className="text-accent" />
      </div>
      <h2 className="text-[20px] font-semibold text-text-primary mb-2">Carousel Scheduled!</h2>
      <p className="text-[13px] text-text-muted mb-1">
        <strong className="text-text-primary">{slides.length} slides</strong> on &ldquo;{form.topic}&rdquo;
      </p>
      <p className="text-[13px] text-text-muted mb-6">
        Platforms: {form.platforms.join(', ')} &middot; Post #{createdPostId}
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => { setStep(0); setForm(f => ({ ...f, topic: '' })); setSlides([]); setError(''); }}
          className="px-4 py-2 rounded-btn border border-border text-[13px] text-text-secondary hover:bg-bg-elevated transition-colors"
        >
          Create Another
        </button>
        <Link to="/pipeline"
          className="px-4 py-2 rounded-btn bg-accent text-white text-[13px] font-medium hover:bg-accent/90 transition-colors">
          Go to Pipeline
        </Link>
      </div>
    </div>
  );

  // ── Step 1: Edit Slides ────────────────────────────────────────────────────
  if (step === 1) return (
    <div className="fade-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep(0)} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-[18px] font-semibold text-text-primary">Edit Slides</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Click any slide to edit the text. Bold words with **word**.</p>
        </div>
        {/* Active template badge */}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-text-muted">
          <span>Template:</span>
          <span className="font-semibold text-accent">
            {TEMPLATES.find(t => t.id === form.templateName)?.name}
          </span>
        </div>
      </div>

      <Steps current={1} />

      {/* Slide grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {slides.map((slide, i) => (
          <SlideCard
            key={i}
            index={i}
            slide={slide}
            onChange={q => updateSlide(i, q)}
            clientName={selectedClientName}
            templateId={form.templateName}
          />
        ))}
      </div>

      {/* Summary bar + actions */}
      <div className="flex items-center justify-between bg-bg-elevated border border-border rounded-card px-5 py-3">
        <div className="flex items-center gap-4 text-[12px] text-text-muted">
          <span><strong className="text-text-primary">{slides.length}</strong> slides</span>
          <span className="text-border">|</span>
          <span>{form.platforms.join(' · ')}</span>
          <span className="text-border">|</span>
          <span>{new Date(form.scheduledAt).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          {error && <p className="text-[12px] text-status-error">{error}</p>}
          <button onClick={() => setStep(0)}
            className="px-4 py-2 rounded-btn border border-border text-[13px] text-text-secondary hover:bg-bg-overlay transition-colors">
            ← Back
          </button>
          <button onClick={handleSchedule} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-btn bg-accent text-white text-[13px] font-medium hover:bg-accent/90 disabled:opacity-60 transition-colors">
            {loading ? 'Rendering & Scheduling…' : <><Zap size={14} /> Schedule Carousel</>}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step 0: Configure ──────────────────────────────────────────────────────
  return (
    <div className="fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/pipeline" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-[18px] font-semibold text-text-primary">New Carousel</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Configure your carousel then edit each slide before scheduling.</p>
        </div>
      </div>

      <Steps current={0} />

      <div className="grid grid-cols-5 gap-6">

        {/* ── Left: form ──────────────────────────────────────────────────── */}
        <div className="col-span-3 space-y-5">

          {/* Client */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Client</label>
            <select value={form.clientId}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              className="h-10 px-3 bg-bg-elevated border border-border rounded-btn text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="">Select a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Topic */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Topic</label>
            <input
              type="text"
              value={form.topic}
              autoFocus
              onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="e.g. 5 habits of successful entrepreneurs"
              className="h-10 px-3 bg-bg-elevated border border-border rounded-btn text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Slide count */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Number of slides</label>
            <div className="flex gap-2">
              {SLIDE_COUNTS.map(n => (
                <button key={n} type="button" onClick={() => setForm(f => ({ ...f, slideCount: n }))}
                  className={`w-11 h-10 rounded-btn text-[13px] font-medium border transition-colors ${
                    form.slideCount === n
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg-elevated text-text-secondary border-border hover:border-accent'
                  }`}>{n}</button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => {
                const Icon = PLATFORM_ICONS[p];
                const active = form.platforms.includes(p);
                return (
                  <button key={p} type="button" onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-btn text-[12px] font-medium border capitalize transition-colors ${
                      active
                        ? 'bg-accent text-white border-accent'
                        : 'bg-bg-elevated text-text-secondary border-border hover:border-accent'
                    }`}>
                    {Icon && <Icon size={13} />}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Schedule</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              min={localISO(new Date(Date.now() + 5 * 60 * 1000))}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              className="h-10 px-3 bg-bg-elevated border border-border rounded-btn text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Template selector — full width */}
          <TemplateSelector
            value={form.templateName}
            onChange={v => setForm(f => ({ ...f, templateName: v }))}
            clientName={selectedClientName}
          />

          {error && <p className="text-[12px] text-status-error">{error}</p>}

          {/* CTA */}
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-btn bg-accent text-white text-[13px] font-semibold hover:bg-accent/90 disabled:opacity-60 transition-colors">
            {loading
              ? 'Generating slides…'
              : <><Zap size={14} /> Generate {form.slideCount} Slides <ArrowRight size={14} /></>
            }
          </button>
        </div>

        {/* ── Right: info panel ────────────────────────────────────────────── */}
        <div className="col-span-2 space-y-4">
          <div className="bg-bg-elevated border border-border rounded-card p-4 space-y-3">
            <h3 className="text-[12px] font-semibold text-text-primary">How it works</h3>
            {[
              { num: 1, text: 'Claude generates punchy quote slides based on your topic' },
              { num: 2, text: 'Review and edit each slide individually' },
              { num: 3, text: 'Images are rendered and scheduled to your platforms' },
            ].map(({ num, text }) => (
              <div key={num} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-accent">{num}</span>
                </div>
                <p className="text-[12px] text-text-muted leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Live summary */}
          {(form.topic || form.platforms.length > 0) && (
            <div className="bg-bg-elevated border border-border rounded-card p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-3">Summary</h3>
              <div className="space-y-2">
                {form.topic && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-text-muted w-16 flex-shrink-0 mt-0.5">Topic</span>
                    <span className="text-[12px] text-text-primary">{form.topic}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-text-muted w-16 flex-shrink-0 mt-0.5">Slides</span>
                  <span className="text-[12px] text-text-primary">{form.slideCount}</span>
                </div>
                {form.platforms.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-text-muted w-16 flex-shrink-0 mt-0.5">Platforms</span>
                    <span className="text-[12px] text-text-primary capitalize">{form.platforms.join(', ')}</span>
                  </div>
                )}
                {form.scheduledAt && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-text-muted w-16 flex-shrink-0 mt-0.5">At</span>
                    <span className="text-[12px] text-text-primary">
                      {new Date(form.scheduledAt).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-text-muted w-16 flex-shrink-0 mt-0.5">Style</span>
                  <span className="text-[12px] text-accent font-medium">
                    {TEMPLATES.find(t => t.id === form.templateName)?.name}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
