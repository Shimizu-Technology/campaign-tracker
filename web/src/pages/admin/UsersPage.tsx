import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Home, Mail, Pencil, Plus, Save, Search, Users, X } from 'lucide-react';
import { createUser, getUsers, resendUserInvite, updateUser } from '../../lib/api';

interface UserItem {
  id: number;
  email: string;
  name: string | null;
  role: string;
  created_at?: string;
  assigned_district_id: number | null;
  assigned_village_id: number | null;
  assigned_block_id: number | null;
}

interface UsersResponse {
  users: UserItem[];
  roles: string[];
}

interface RoleGuideRow {
  role: string;
  level: string;
  who: string;
  can: string;
}

interface UserDraft {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

function splitName(fullName: string | null): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function joinName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ');
}

const ROLE_GUIDE: RoleGuideRow[] = [
  {
    role: 'campaign_admin',
    level: 'Level 1',
    who: 'Campaign leadership / trusted admins',
    can: 'Full system access, manage users/roles, edit supporters, run operations tools',
  },
  {
    role: 'district_coordinator',
    level: 'Level 2',
    who: 'District managers',
    can: 'Edit supporters and manage district-level field operations',
  },
  {
    role: 'village_chief',
    level: 'Level 3',
    who: 'Village coordinators',
    can: 'View and coordinate village execution without broad edit/admin controls',
  },
  {
    role: 'block_leader',
    level: 'Level 4',
    who: 'Street/block organizers',
    can: 'Submit and track supporter activity for assigned areas',
  },
  {
    role: 'poll_watcher',
    level: 'Level 5',
    who: 'Election day reporting staff',
    can: 'Submit polling/turnout updates and monitor election-day status',
  },
];

function roleLabel(role: string) {
  return role.replaceAll('_', ' ');
}

type UserSortField = 'name' | 'email' | 'role' | 'created_at';
const SORT_FIELDS: UserSortField[] = ['name', 'email', 'role', 'created_at'];

function parseSortField(value: string | null): UserSortField {
  return SORT_FIELDS.includes(value as UserSortField) ? (value as UserSortField) : 'role';
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, error, refetch, isFetching } = useQuery<UsersResponse>({
    queryKey: ['users'],
    queryFn: getUsers,
    // During local dev/hot-reload, token sync can briefly race API calls.
    // Retry a few times so the page self-recovers without manual refresh.
    retry: (failureCount, err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) return failureCount < 3;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min((attemptIndex + 1) * 800, 2500),
    refetchOnWindowFocus: true,
  });

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('block_leader');
  const [draftByUser, setDraftByUser] = useState<Record<number, UserDraft>>({});
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [sortBy, setSortBy] = useState<UserSortField>(parseSortField(searchParams.get('sort_by')));
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((searchParams.get('sort_dir') as 'asc' | 'desc') || 'asc');

  const roles = useMemo(() => data?.roles || [], [data]);
  const users = useMemo(() => data?.users || [], [data]);
  const filteredUsers = useMemo(() => {
    const lowered = search.trim().toLowerCase();
    const filtered = users.filter((u) => {
      const searchHit = lowered.length === 0 ||
        (u.name || '').toLowerCase().includes(lowered) ||
        u.email.toLowerCase().includes(lowered);
      const roleHit = roleFilter ? u.role === roleFilter : true;
      return searchHit && roleHit;
    });

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'created_at') {
        const aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (aVal - bVal) * dir;
      }
      if (sortBy === 'name') {
        return ((a.name || '').localeCompare(b.name || '')) * dir;
      }
      if (sortBy === 'role') {
        return a.role.localeCompare(b.role) * dir;
      }
      return a.email.localeCompare(b.email) * dir;
    });

    return sorted;
  }, [users, search, roleFilter, sortBy, sortDir]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    params.set('sort_by', sortBy);
    params.set('sort_dir', sortDir);
    setSearchParams(params, { replace: true });
  }, [search, roleFilter, sortBy, sortDir, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: () => createUser({ email: newEmail, role: newRole }),
    onSuccess: () => {
      setNewEmail('');
      setNewRole('block_leader');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserDraft }) =>
      updateUser(id, {
        name: joinName(payload.firstName, payload.lastName) || null,
        email: payload.email.trim(),
        role: payload.role,
      }),
    onSuccess: (_data, variables) => {
      setDraftByUser((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (id: number) => resendUserInvite(id),
    onSuccess: (_data, id) => {
      const user = users.find((u) => u.id === id);
      setInviteNotice(`Invite email queued for ${user?.email || 'user'}`);
      setTimeout(() => setInviteNotice(null), 4000);
    },
  });

  const getDraft = (user: UserItem): UserDraft => {
    if (draftByUser[user.id]) return draftByUser[user.id];
    const { firstName, lastName } = splitName(user.name);
    return { firstName, lastName, email: user.email, role: user.role };
  };

  const startEdit = (user: UserItem) => {
    const { firstName, lastName } = splitName(user.name);
    setDraftByUser((prev) => ({
      ...prev,
      [user.id]: { firstName, lastName, email: user.email, role: user.role },
    }));
  };

  const cancelEdit = (userId: number) => {
    setDraftByUser((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const pendingSaves = useMemo(
    () => Object.entries(draftByUser).filter(([id, draft]) => {
      const user = users.find((u) => u.id === Number(id));
      if (!user) return false;
      return (
        (user.name || '') !== joinName(draft.firstName, draft.lastName) ||
        user.email !== draft.email.trim().toLowerCase() ||
        user.role !== draft.role
      );
    }),
    [draftByUser, users]
  );

  const handleSort = (field: UserSortField) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortDir(field === 'created_at' ? 'desc' : 'asc');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <Link to="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <Link to="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <Home className="w-4 h-4" /> Home
          </Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#1B3A6B]" /> User Management
        </h1>
        <p className="text-gray-500 text-sm">Authorized managers can invite users and assign allowed campaign roles.</p>
      </div>

      <div className="space-y-6">
        <section className="app-card p-4">
          <h2 className="app-section-title text-xl mb-2">Add User</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Use the same email they will use with Clerk. Name comes from Clerk profile on first login.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 md:col-span-2 min-h-[44px]"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] min-h-[44px]"
            >
              {roles.map((role) => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!newEmail || createMutation.isPending}
            className="mt-3 bg-[#1B3A6B] text-white px-4 py-2 rounded-xl min-h-[44px] text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {createMutation.isPending ? 'Adding...' : 'Add User'}
          </button>
          {createMutation.isError && (
            <p className="text-sm text-red-600 mt-2">Could not add user. Check email/role and try again.</p>
          )}
          {inviteNotice && (
            <p className="text-sm text-green-700 mt-2">{inviteNotice}</p>
          )}
        </section>

        <section className="app-card overflow-hidden">
          <details>
            <summary className="cursor-pointer px-4 py-3 border-b bg-[var(--surface-bg)]">
              <h2 className="app-section-title text-lg inline">Role Matrix</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Reference guide for what each campaign role is intended to do.</p>
            </summary>
            <div className="md:hidden divide-y">
              {ROLE_GUIDE.map((row) => (
                <div key={row.role} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{roleLabel(row.role)}</span>
                    <span className="text-xs app-chip bg-[var(--surface-overlay)] text-[var(--text-primary)]">{row.level}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{row.who}</p>
                  <p className="text-xs text-[var(--text-primary)]">{row.can}</p>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[var(--surface-bg)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Hierarchy</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Typical User</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Primary Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLE_GUIDE.map((row) => (
                    <tr key={row.role} className="border-b">
                      <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{roleLabel(row.role)}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{row.level}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{row.who}</td>
                      <td className="px-4 py-3 text-[var(--text-primary)]">{row.can}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section className="app-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-[var(--surface-bg)] flex items-center justify-between">
            <h2 className="app-section-title text-lg">Existing Users</h2>
            {pendingSaves.length > 0 && (
              <span className="text-xs text-amber-700">{pendingSaves.length} unsaved role change(s)</span>
            )}
          </div>
          {isLoading ? (
            <div className="p-4 text-sm text-[var(--text-muted)]">Loading users...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600 space-y-2">
                  Could not load users. Please try again.
              <div>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="bg-[#1B3A6B] text-white px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium disabled:opacity-50"
                >
                  {isFetching ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b bg-[var(--surface-raised)] grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-9 pr-3 py-2 border border-[var(--border-soft)] rounded-xl min-h-[44px]"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] min-h-[44px]"
                >
                  <option value="">All roles</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>{roleLabel(role)}</option>
                  ))}
                </select>
                <select
                  value={`${sortBy}:${sortDir}`}
                  onChange={(e) => {
                    const [field, dir] = e.target.value.split(':') as [UserSortField, 'asc' | 'desc'];
                    setSortBy(field);
                    setSortDir(dir);
                  }}
                  className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] min-h-[44px]"
                >
                  <option value="role:asc">Role A-Z</option>
                  <option value="role:desc">Role Z-A</option>
                  <option value="name:asc">Name A-Z</option>
                  <option value="name:desc">Name Z-A</option>
                  <option value="email:asc">Email A-Z</option>
                  <option value="email:desc">Email Z-A</option>
                  <option value="created_at:desc">Newest first</option>
                  <option value="created_at:asc">Oldest first</option>
                </select>
              </div>
              <div className="px-4 pt-2">
                <p
                  aria-live="polite"
                  className={`text-xs text-[var(--text-muted)] transition-opacity duration-200 ${isFetching ? 'opacity-100' : 'opacity-0'}`}
                >
                  Updating...
                </p>
              </div>

              <div className={`md:hidden divide-y transition-opacity duration-200 ${isFetching ? 'opacity-70' : 'opacity-100'}`}>
                {filteredUsers.map((user) => {
                  const isEditing = Boolean(draftByUser[user.id]);
                  const draft = getDraft(user);
                  const changed = (
                    (user.name || '') !== joinName(draft.firstName, draft.lastName) ||
                    user.email !== draft.email.trim().toLowerCase() ||
                    user.role !== draft.role
                  );

                  return (
                    <div key={user.id} className="p-4 space-y-3">
                      {isEditing ? (
                        <div className="grid grid-cols-1 gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={draft.firstName}
                              onChange={(e) => setDraftByUser((prev) => ({ ...prev, [user.id]: { ...draft, firstName: e.target.value } }))}
                              placeholder="First Name"
                              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 min-h-[44px]"
                            />
                            <input
                              type="text"
                              value={draft.lastName}
                              onChange={(e) => setDraftByUser((prev) => ({ ...prev, [user.id]: { ...draft, lastName: e.target.value } }))}
                              placeholder="Last Name"
                              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 min-h-[44px]"
                            />
                          </div>
                          <input
                            type="email"
                            value={draft.email}
                            onChange={(e) => setDraftByUser((prev) => ({ ...prev, [user.id]: { ...draft, email: e.target.value } }))}
                            placeholder="Email"
                            className="border border-[var(--border-soft)] rounded-xl px-3 py-2 min-h-[44px]"
                          />
                          <select
                            value={draft.role}
                            onChange={(e) => setDraftByUser((prev) => ({ ...prev, [user.id]: { ...draft, role: e.target.value } }))}
                            className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] min-h-[44px]"
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>{roleLabel(role)}</option>
                            ))}
                          </select>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              disabled={!changed || updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ id: user.id, payload: draft })}
                              className="bg-[#1B3A6B] text-white px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Save className="w-3.5 h-3.5" /> Save
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelEdit(user.id)}
                              className="bg-[var(--surface-raised)] border border-[var(--border-soft)] text-[var(--text-primary)] px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center justify-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                            <button
                              type="button"
                              disabled={resendInviteMutation.isPending}
                              onClick={() => resendInviteMutation.mutate(user.id)}
                              className="bg-[var(--surface-raised)] border border-[var(--border-soft)] text-[var(--text-primary)] px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Mail className="w-3.5 h-3.5" /> Resend
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{user.name || 'Unnamed user'}</p>
                            <p className="text-xs text-[var(--text-secondary)] break-all">{user.email}</p>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Role: {roleLabel(user.role)}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(user)}
                              className="bg-[#1B3A6B] text-white px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center justify-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              disabled={resendInviteMutation.isPending}
                              onClick={() => resendInviteMutation.mutate(user.id)}
                              className="bg-[var(--surface-raised)] border border-[var(--border-soft)] text-[var(--text-primary)] px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Mail className="w-3.5 h-3.5" /> Resend
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="p-4 text-sm text-[var(--text-muted)]">No users match current filters.</div>
                )}
              </div>

              <div className={`hidden md:block overflow-x-auto transition-opacity duration-200 ${isFetching ? 'opacity-80' : 'opacity-100'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[var(--surface-bg)]">
                      <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                        <button type="button" onClick={() => handleSort('name')} className="hover:text-[var(--text-primary)]">Name</button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                        <button type="button" onClick={() => handleSort('email')} className="hover:text-[var(--text-primary)]">Email</button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                        <button type="button" onClick={() => handleSort('role')} className="hover:text-[var(--text-primary)]">Role</button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const isEditing = Boolean(draftByUser[user.id]);
                      const draft = getDraft(user);
                      const changed = (
                        (user.name || '') !== joinName(draft.firstName, draft.lastName) ||
                        user.email !== draft.email.trim().toLowerCase() ||
                        user.role !== draft.role
                      );

                      return (
                        <tr key={user.id} className="border-b">
                          <td className="px-4 py-3 text-[var(--text-primary)]">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={draft.firstName}
                                  onChange={(e) => setDraftByUser((prev) => ({ ...prev, [user.id]: { ...draft, firstName: e.target.value } }))}
                                  placeholder="First"
                                  className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] min-h-[44px] w-full"
                                />
                                <input
                                  type="text"
                                  value={draft.lastName}
                                  onChange={(e) => setDraftByUser((prev) => ({ ...prev, [user.id]: { ...draft, lastName: e.target.value } }))}
                                  placeholder="Last"
                                  className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] min-h-[44px] w-full"
                                />
                              </div>
                            ) : (
                              user.name || '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {isEditing ? (
                              <input
                                type="email"
                                value={draft.email}
                                onChange={(e) => setDraftByUser((prev) => ({ ...prev, [user.id]: { ...draft, email: e.target.value } }))}
                                className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] min-h-[44px] w-full"
                              />
                            ) : (
                              user.email
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <select
                                value={draft.role}
                                onChange={(e) => setDraftByUser((prev) => ({ ...prev, [user.id]: { ...draft, role: e.target.value } }))}
                                className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] min-h-[44px]"
                              >
                                {roles.map((role) => (
                                  <option key={role} value={role}>{roleLabel(role)}</option>
                                ))}
                              </select>
                            ) : (
                              roleLabel(user.role)
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={!changed || updateMutation.isPending}
                                    onClick={() => updateMutation.mutate({ id: user.id, payload: draft })}
                                    className="bg-[#1B3A6B] text-white px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Save className="w-3.5 h-3.5" /> Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cancelEdit(user.id)}
                                    className="bg-[var(--surface-raised)] border border-[var(--border-soft)] text-[var(--text-primary)] px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center gap-1"
                                  >
                                    <X className="w-3.5 h-3.5" /> Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(user)}
                                  className="bg-[#1B3A6B] text-white px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center gap-1"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Edit
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={resendInviteMutation.isPending}
                                onClick={() => resendInviteMutation.mutate(user.id)}
                                className="bg-[var(--surface-raised)] border border-[var(--border-soft)] text-[var(--text-primary)] px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <Mail className="w-3.5 h-3.5" /> Resend
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">
                          No users match current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
