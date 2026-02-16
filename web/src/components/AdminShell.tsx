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
        ...(permissions?.can_access_war_room ? [ { to: '/admin/war-room', label: 'War Room', icon: TrendingUp } ] : []),
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
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
          active
            ? 'bg-[var(--campaign-blue)] text-white shadow-md shadow-[var(--campaign-blue)]/25'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-200' : 'text-[var(--text-muted)]'}`} />
        <span className="truncate">{item.label}</span>
        {item.badge && item.badge > 0 ? (
          <span className="ml-auto bg-[var(--campaign-red)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
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
        <Link to="/admin" className="block group" onClick={() => setSidebarOpen(false)}>
          <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight group-hover:text-blue-300 transition-colors">
            {campaignName}
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">
            Campaign Tracker
          </p>
        </Link>
      </div>

      {/* Nav Groups */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.08em]">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(navLink)}
            </div>
          </div>
        ))}
      </div>

      {/* User */}
      <div className="border-t border-[var(--border-soft)] px-4 py-4 flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
            {sessionData?.user?.name || sessionData?.user?.email || 'Loading...'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] truncate capitalize">
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
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[220px] lg:flex-col bg-[var(--surface-raised)] border-r border-[var(--border-soft)] z-30">
        {sidebarContent}
      </aside>

      {/* Sidebar - mobile */}
      <aside
        className={`fixed inset-y-0 left-0 w-[280px] bg-[var(--surface-raised)] border-r border-[var(--border-soft)] z-50 transform transition-transform duration-200 ease-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-5 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--surface-overlay)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="lg:pl-[220px]">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-[var(--surface-raised)]/95 backdrop-blur-md border-b border-[var(--border-soft)] px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--surface-overlay)] transition-colors"
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
