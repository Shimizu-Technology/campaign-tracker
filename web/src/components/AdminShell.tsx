import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useSession } from '../hooks/useSession';
import {
  LayoutDashboard,
  Users,
  ClipboardPlus,
  CalendarPlus,
  Camera,
  QrCode,
  Trophy,
  MessageSquare,
  Mail,
  Shield,
  Target,
  MapPin,
  Upload,
  ShieldCheck,
  Copy,
  TrendingUp,
  Menu,
  X,
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: sessionData } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const permissions = sessionData?.permissions;

  const navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        ...(permissions?.can_view_supporters ? [ { to: '/admin/supporters', label: 'Supporters', icon: Users } ] : []),
        ...(permissions?.can_access_events ? [ { to: '/admin/events', label: 'Events', icon: CalendarPlus } ] : []),
      ],
    },
    {
      label: 'Data Entry',
      items: [
        ...(permissions?.can_create_staff_supporters ? [ { to: '/admin/scan', label: 'Scan Form', icon: Camera } ] : []),
        ...(permissions?.can_create_staff_supporters ? [ { to: '/admin/supporters/new', label: 'New Entry', icon: ClipboardPlus } ] : []),
        ...(permissions?.can_edit_supporters ? [ { to: '/admin/import', label: 'Import', icon: Upload } ] : []),
      ],
    },
    {
      label: 'Outreach',
      items: [
        ...(permissions?.can_send_sms ? [ { to: '/admin/sms', label: 'SMS Blasts', icon: MessageSquare } ] : []),
        ...(permissions?.can_send_email ? [ { to: '/admin/email', label: 'Email Blasts', icon: Mail } ] : []),
        ...(permissions?.can_access_qr ? [ { to: '/admin/qr', label: 'QR Codes', icon: QrCode } ] : []),
      ],
    },
    {
      label: 'Review',
      items: [
        ...(permissions?.can_view_supporters ? [ { to: '/admin/vetting', label: 'Vetting', icon: ShieldCheck, badge: sessionData?.counts?.pending_vetting || 0 } ] : []),
        ...(permissions?.can_view_supporters ? [ { to: '/admin/duplicates', label: 'Duplicates', icon: Copy } ] : []),
        ...(permissions?.can_access_leaderboard ? [ { to: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy } ] : []),
      ],
    },
    {
      label: 'Operations',
      items: [
        ...(permissions?.can_access_war_room ? [ { to: '/admin/war-room', label: 'War Room', icon: TrendingUp } ] : []),
        ...(permissions?.can_access_poll_watcher ? [ { to: '/admin/poll-watcher', label: 'Poll Watcher', icon: MapPin } ] : []),
      ],
    },
    {
      label: 'Settings',
      items: [
        ...(permissions?.can_manage_users ? [ { to: '/admin/users', label: 'Users', icon: Shield } ] : []),
        ...(permissions?.can_manage_configuration ? [ { to: '/admin/quotas', label: 'Quotas', icon: Target } ] : []),
        ...(permissions?.can_manage_configuration ? [ { to: '/admin/precincts', label: 'Precincts', icon: MapPin } ] : []),
      ],
    },
  ].filter(g => g.items.length > 0);

  const isActive = (to: string) => {
    if (to === '/admin') return location.pathname === '/admin';
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  const campaignName = 'Josh & Tina 2026';

  const navLink = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
          active
            ? 'bg-[#1B3A6B] text-white shadow-md shadow-[#1B3A6B]/25'
            : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-200' : 'text-neutral-500'}`} />
        <span className="truncate">{item.label}</span>
        {item.badge && item.badge > 0 ? (
          <span className="ml-auto bg-[#C41E3A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const sidebarContent = (
    <nav className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5">
        <Link to="/admin" className="block group">
          <h1 className="text-[15px] font-bold text-white tracking-tight group-hover:text-blue-200 transition-colors">
            {campaignName}
          </h1>
          <p className="text-[11px] text-neutral-500 mt-1 font-medium">
            Campaign Tracker
          </p>
        </Link>
      </div>

      {/* Nav Groups */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold text-neutral-600 uppercase tracking-[0.08em]">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(navLink)}
            </div>
          </div>
        ))}
      </div>

      {/* User */}
      <div className="border-t border-neutral-800 px-4 py-4 flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-neutral-200 truncate">
            {sessionData?.user?.name || sessionData?.user?.email || 'Loading...'}
          </div>
          <div className="text-[11px] text-neutral-500 truncate capitalize">
            {sessionData?.user?.role?.replace(/_/g, ' ') || ''}
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[var(--surface-bg)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[220px] lg:flex-col bg-[#0a0a0b] border-r border-neutral-800 z-30">
        {sidebarContent}
      </aside>

      {/* Sidebar - mobile */}
      <aside
        className={`fixed inset-y-0 left-0 w-[280px] bg-[#0a0a0b] border-r border-neutral-800 z-50 transform transition-transform duration-200 ease-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-5 right-4 text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="lg:pl-[220px]">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[var(--border-soft)] px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-neutral-500 hover:text-neutral-800 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{campaignName}</h1>
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Page content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}
