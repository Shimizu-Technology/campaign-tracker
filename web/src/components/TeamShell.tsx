import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useSession } from '../hooks/useSession';
import { useCampaignUpdates } from '../hooks/useCampaignUpdates';
import { useRealtimeToast } from '../hooks/useRealtimeToast';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Upload,
  FileSpreadsheet,
  UserCheck,
  Camera,
  ClipboardPlus,
  ScrollText,
  Copy,
  Menu,
  X,
  Home,
  Database,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function TeamShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: sessionData } = useSession();
  const { toasts, handleEvent, dismiss } = useRealtimeToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useCampaignUpdates(handleEvent, true);

  const counts = sessionData?.counts;

  const navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { to: '/team', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/team/supporters', label: 'Supporters', icon: Users },
      ],
    },
    {
      label: 'Data Entry',
      items: [
        { to: '/team/scan', label: 'Scan Blue Form', icon: Camera },
        { to: '/team/entry', label: 'Manual Entry', icon: ClipboardPlus },
        { to: '/team/import', label: 'Excel Import', icon: Upload },
        { to: '/team/gec', label: 'GEC Voter List', icon: Database },
      ],
    },
    {
      label: 'Review',
      items: [
        { to: '/team/vetting', label: 'Vetting Queue', icon: ShieldCheck, badge: (counts?.flagged_supporters || 0) + (counts?.pending_vetting || 0) },
        { to: '/team/public-review', label: 'Public Signups', icon: UserCheck, badge: counts?.public_signups_pending || 0 },
        { to: '/team/duplicates', label: 'Duplicates', icon: Copy },
      ],
    },
    {
      label: 'Reports',
      items: [
        { to: '/team/reports', label: 'Generate Reports', icon: FileSpreadsheet },
        { to: '/team/audit-logs', label: 'Activity Log', icon: ScrollText },
      ],
    },
  ];

  const isActive = (to: string) => {
    if (to === '/team') return location.pathname === '/team';
    if (location.pathname === to) return true;
    if (location.pathname.startsWith(to + '/')) {
      const allPaths = navGroups.flatMap(g => g.items.map(i => i.to));
      return !allPaths.some(p => p !== to && p.startsWith(to) && location.pathname.startsWith(p));
    }
    return false;
  };

  const navLink = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
          active
            ? 'bg-primary text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-200' : 'text-gray-400'}`} />
        <span className="truncate">{item.label}</span>
        {item.badge && item.badge > 0 ? (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const sidebarContent = (
    <nav className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5">
        <Link to="/team" className="block group" onClick={() => setSidebarOpen(false)}>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-gray-900">Data Team</span>
          </div>
          <p className="text-[11px] text-gray-400 font-medium">
            Voter Operations
          </p>
        </Link>
      </div>

      {/* Quota Progress */}
      {counts?.quota_eligible !== undefined && (
        <div className="mx-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Quota Eligible</div>
          <div className="text-2xl font-bold text-blue-900">{(counts.quota_eligible || 0).toLocaleString()}</div>
        </div>
      )}

      {/* Nav Groups */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-[0.08em]">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(navLink)}
            </div>
          </div>
        ))}
      </div>

      {/* Admin link (for campaign_admin users) */}
      {sessionData?.user?.role === 'campaign_admin' && (
        <div className="border-t border-gray-200 pt-3 px-3 pb-2">
          <Link
            to="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150"
          >
            <Home className="w-4 h-4 shrink-0 text-gray-400" />
            <span>Full Admin Panel</span>
          </Link>
        </div>
      )}

      {/* User */}
      <div className="border-t border-gray-200 px-4 py-4 flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-gray-900 truncate">
            {sessionData?.user?.name || sessionData?.user?.email || 'Loading...'}
          </div>
          <div className="text-[11px] text-gray-400 truncate capitalize">
            {sessionData?.user?.role?.replace(/_/g, ' ') || ''}
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[220px] lg:flex-col bg-white border-r border-gray-200 shadow-sm z-30">
        {sidebarContent}
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 w-[280px] bg-white border-r border-gray-200 shadow-xl z-50 transform transition-transform duration-200 ease-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-5 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      <div className="lg:pl-[220px]">
        {toasts.length > 0 && (
          <div className="fixed top-16 left-2 right-2 sm:left-auto sm:right-4 z-50 space-y-2 max-w-sm sm:max-w-md">
            {toasts.map(toast => (
              <div
                key={toast.id}
                className={`rounded-lg p-3 pr-8 shadow-lg border text-sm animate-slide-in relative ${
                  toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                  toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                  'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                {toast.message}
                <button
                  onClick={() => dismiss(toast.id)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <header className="lg:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-gray-900 tracking-tight">Data Team</h1>
          <UserButton afterSignOutUrl="/" />
        </header>

        <main>
          {children}
        </main>
      </div>
    </div>
  );
}
