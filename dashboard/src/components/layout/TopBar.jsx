import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';

const PAGE_TITLES = {
  '/':             'Overview',
  '/clients':      'Clients',
  '/pipeline':     'Pipeline',
  '/scheduler':    'Scheduler',
  '/analytics':    'Analytics',
  '/connections':  'Platform Connections',
  '/templates':    'Templates',
  '/settings':     'Settings',
  '/carousel/new': 'New Carousel',
};

export function TopBar() {
  const location = useLocation();

  const title =
    PAGE_TITLES[location.pathname] ||
    Object.entries(PAGE_TITLES).find(
      ([path]) => path !== '/' && location.pathname.startsWith(path)
    )?.[1] ||
    'AutoMonk';

  return (
    <header
      className="fixed top-0 left-[260px] right-0 h-14 flex items-center px-6 z-30"
      style={{
        background: 'hsl(220,14%,9%)',
        borderBottom: '1px solid hsl(220,13%,16%)',
      }}
    >
      {/* Page title */}
      <h1 className="text-[14px] font-semibold text-foreground">
        {title}
      </h1>

      {/* Search — centered */}
      <div className="mx-auto relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          style={{ width: '13px', height: '13px' }}
        />
        <input
          type="text"
          placeholder="Search…"
          readOnly
          className="pl-8 pr-4 h-9 rounded-xl text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors w-[260px]"
          style={{
            background: 'hsl(220,13%,16%)',
            border: '1px solid hsl(220,13%,22%)',
          }}
        />
      </div>

      {/* Avatar */}
      <div className="w-[200px] flex justify-end">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 select-none"
          style={{
            background: 'hsl(24,94%,53%)',
            fontSize: '11px',
            fontWeight: 700,
            color: '#fff',
          }}
        >
          OP
        </div>
      </div>
    </header>
  );
}
