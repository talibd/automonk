import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Calendar,
  BarChart2, Link2, FileImage, Settings, LogOut, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth.js';

const NAV_ITEMS = [
  { to: '/',            icon: LayoutDashboard, label: 'Overview',   end: true },
  { to: '/clients',     icon: Users,           label: 'Clients' },
  { to: '/pipeline',    icon: GitBranch,       label: 'Pipeline' },
  { to: '/scheduler',   icon: Calendar,        label: 'Scheduler' },
  { to: '/analytics',   icon: BarChart2,       label: 'Analytics' },
  { to: '/connections', icon: Link2,           label: 'Platforms' },
  { to: '/templates',   icon: FileImage,       label: 'Templates' },
  { to: '/settings',    icon: Settings,        label: 'Settings' },
];

export function Sidebar() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-40"
      style={{ background: 'hsl(220,13%,12%)', borderRight: '1px solid hsl(220,13%,20%)' }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 flex-shrink-0" style={{ borderBottom: '1px solid hsl(220,13%,20%)' }}>
        <div className="flex items-center gap-2.5">
          <Zap
            style={{ width: '18px', height: '18px', flexShrink: 0, color: 'hsl(24,94%,53%)' }}
            strokeWidth={2.5}
          />
          <span className="text-[15px] font-bold tracking-tight" style={{ color: 'hsl(220,10%,96%)' }}>
            AutoMonk
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors duration-100 select-none',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
                style={({ isActive }) =>
                  isActive
                    ? { background: 'hsl(220,13%,17%)' }
                    : {}
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      style={{
                        width: '17px',
                        height: '17px',
                        flexShrink: 0,
                        color: isActive ? 'hsl(24,94%,53%)' : undefined,
                      }}
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* CTA card */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div
          className="rounded-2xl p-5"
          style={{ background: 'hsl(24,94%,53%)' }}
        >
          <Zap
            style={{ width: '20px', height: '20px', color: 'rgba(255,255,255,0.85)' }}
            strokeWidth={2}
            className="mb-3"
          />
          <p className="text-white font-bold text-[13px] leading-tight mb-1">
            New Carousel
          </p>
          <p className="text-[11px] mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Schedule a post right now
          </p>
          <button
            onClick={() => navigate('/carousel/new')}
            className="w-full rounded-xl bg-white text-[12px] font-semibold py-2 transition-colors hover:bg-white/92"
            style={{ color: 'hsl(24,94%,53%)' }}
          >
            Create now →
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="px-3 pb-4 flex-shrink-0" style={{ borderTop: '1px solid hsl(220,13%,20%)' }}>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 mt-3 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(220,13%,17%)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut style={{ width: '17px', height: '17px', flexShrink: 0 }} strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </aside>
  );
}
