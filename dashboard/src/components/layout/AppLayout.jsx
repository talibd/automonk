import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

export function AppLayout() {
  return (
    <div className="min-h-screen" style={{ background: 'hsl(220,14%,9%)' }}>
      <Sidebar />
      <TopBar />
      <main className="ml-[260px] pt-14 min-h-screen">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
