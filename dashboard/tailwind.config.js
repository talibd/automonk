/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary:     { DEFAULT: 'hsl(var(--primary))',     foreground: 'hsl(var(--primary-foreground))'     },
        secondary:   { DEFAULT: 'hsl(var(--secondary))',   foreground: 'hsl(var(--secondary-foreground))'   },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))',       foreground: 'hsl(var(--muted-foreground))'       },
        accent:      { DEFAULT: 'hsl(var(--accent))',      foreground: 'hsl(var(--accent-foreground))'      },
        popover:     { DEFAULT: 'hsl(var(--popover))',     foreground: 'hsl(var(--popover-foreground))'     },
        card:        { DEFAULT: 'hsl(var(--card))',        foreground: 'hsl(var(--card-foreground))'        },

        /* Status */
        success: 'rgb(var(--status-success))',
        warning: 'rgb(var(--status-warning))',
        danger:  'rgb(var(--status-error))',

        /* Platform */
        ig: 'rgb(var(--platform-ig))',
        fb: 'rgb(var(--platform-fb))',
        yt: 'rgb(var(--platform-yt))',
        li: 'rgb(var(--platform-li))',

        /* Legacy tokens — keep old pages working during migration */
        'bg-base':        '#0D0F14',
        'bg-surface':     '#141720',
        'bg-elevated':    '#1C2030',
        'bg-overlay':     '#232840',
        'border-subtle':  '#1F2438',
        'text-primary':   '#E8EAF2',
        'text-secondary': '#8B90A8',
        'text-muted':     '#555A72',
        'status-success': '#22C55E',
        'status-warning': '#F59E0B',
        'status-error':   '#EF4444',
        'status-info':    '#38BDF8',
        'status-neutral': '#6B7280',
        'platform-ig':    '#E1306C',
        'platform-fb':    '#1877F2',
        'platform-yt':    '#FF0000',
        'platform-li':    '#0A66C2',
        'platform-tw':    '#E7E9EA',
        'platform-th':    '#E7E9EA',
      },
      borderRadius: {
        lg:    'var(--radius)',
        md:    'calc(var(--radius) - 2px)',
        sm:    'calc(var(--radius) - 4px)',
        card:  '12px',
        btn:   '8px',
        badge: '6px',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-up':        'fadeUp 0.25s ease-out both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
