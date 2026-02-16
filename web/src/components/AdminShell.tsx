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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: sessionData } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Main': true,
    'Data Entry': true,
    'Communication': true,
    'Tools': false,
    'Settings': false,
  });

  const permissions = sessionData?.permissions;

  const navGroups: NavGroup[] = [
    {
      label: 'Main',
      defaultOpen: true,
      items: [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        ...(permissions?.can_view_supporters ? [ { to: '/admin/supporters', label: 'Supporters', icon: Users } ] : []),
        ...(permissions?.can_access_events ? [ { to: '/admin/events', label: 'Events', icon: CalendarPlus } ] : []),
        ...(permissions?.can_access_war_room ? [ { to: '/admin/war-room', label: 'War Room', icon: TrendingUp } ] : []),
      ],
    },
    {
      label: 'Data Entry',
      defaultOpen: true,
      items: [
        ...(permissions?.can_create_staff_supporters ? [ { to: '/admin/scan', label: 'Scan Form', icon: Camera } ] : []),
        ...(permissions?.can_create_staff_supporters ? [ { to: '/admin/supporters/new', label: 'New Entry', icon: ClipboardPlus } ] : []),
        ...(permissions?.can_edit_supporters ? [ { to: '/admin/import', label: 'Import', icon: Upload } ] : []),
      ],
    },
    {
      label: 'Communication',
      items: [
        ...(permissions?.can_send_sms ? [ { to: '/admin/sms', label: 'SMS Blasts', icon: MessageSquare } ] : []),
        ...(permissions?.can_send_email ? [ { to: '/admin/email', label: 'Email Blasts', icon: Mail } ] : []),
      ],
    },
    {
      label: 'Tools',
      items: [
        ...(permissions?.can_view_supporters ? [ { to: '/admin/vetting', label: 'Vetting', icon: ShieldCheck, badge: sessionData?.counts?.pending_vetting || 0 } ] : []),
        ...(permissions?.can_view_supporters ? [ { to: '/admin/duplicates', label: 'Duplicates', icon: Copy } ] : []),
        ...(permissions?.can_access_qr ? [ { to: '/admin/qr', label: 'QR Codes', icon: QrCode } ] : []),
        ...(permissions?.can_access_leaderboard ? [ { to: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy } ] : []),
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

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (to: string) => {
    if (to === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(to);
  };

  const campaignName = sessionData?.user ? 'Josh & Tina 2026' : 'Campaign Tracker';

  const sidebarContent = (
    <nav className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-4 py-5 border-b border-white/10">
        <Link to="/admin" className="block" onClick={() => setSidebarOpen(false)}>
          <h1 className="text-base font-bold text-white tracking-tight">{campaignName}</h1>
          <p className="text-xs text-blue-300/60 mt-0.5">Josh Tenorio & Tina Muña Barnes</p>
        </Link>
      </div>

      {/* Nav Groups */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navGroups.map((group) => {
          const isExpanded = expandedGroups[group.label] ?? group.defaultOpen ?? false;
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-blue-300/50 uppercase tracking-wider hover:text-blue-300/80 transition-colors"
              >
                {group.label}
                {isExpanded
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />
                }
              </button>
              {isExpanded && (
                <div className="space-y-0.5 mt-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          active
                            ? 'bg-white/15 text-white shadow-sm'
                            : 'text-blue-100/70 hover:bg-white/8 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-300' : ''}`} />
                        <span className="truncate">{item.label}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className="ml-auto bg-[#C41E3A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User */}
      <div className="border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{sessionData?.user?.name || sessionData?.user?.email}</div>
          <div className="text-xs text-blue-300/50 truncate">{sessionData?.user?.role?.replace('_', ' ')}</div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#0f1729]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-56 lg:flex-col bg-[#0f1729] border-r border-white/8 z-30">
        {sidebarContent}
      </aside>

      {/* Sidebar - mobile */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-[#0f1729] border-r border-white/10 z-50 transform transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 text-white/60 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="lg:pl-56">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#0f1729]/95 backdrop-blur-sm border-b border-white/8 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/70 hover:text-white p-1"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-white">{campaignName}</h1>
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Page content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
