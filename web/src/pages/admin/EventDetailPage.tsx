import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getEvent, getEventAttendees } from '../../lib/api';
import { CheckCircle, XCircle, ClipboardCheck } from 'lucide-react';

interface Attendee {
  rsvp_id: number;
  print_name: string;
  village: string;
  attended: boolean;
}

export default function EventDetailPage() {
  const { id } = useParams();
  const { data: eventData } = useQuery({ queryKey: ['event', id], queryFn: () => getEvent(Number(id)) });
  const { data: attendeeData } = useQuery({ queryKey: ['attendees', id], queryFn: () => getEventAttendees(Number(id)) });

  const event = eventData?.event;
  const stats = attendeeData?.stats;
  const attendees: Attendee[] = attendeeData?.attendees || [];

  if (!event) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">Loading...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{event.name}</h1>
            <p className="text-gray-500 text-sm">{event.date} · {event.location} · {event.village_name || 'All accessible villages'}</p>
          </div>
          <Link to={`/admin/events/${id}/checkin`}
            className="app-btn-danger">
            <ClipboardCheck className="w-4 h-4" /> Check In
          </Link>
        </div>
      </div>

      <div>
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="app-card p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.total_invited}</div>
              <div className="text-sm text-[var(--text-secondary)]">Invited</div>
            </div>
            <div className="app-card p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.confirmed}</div>
              <div className="text-sm text-[var(--text-secondary)]">Confirmed</div>
            </div>
            <div className="app-card p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.attended}</div>
              <div className="text-sm text-[var(--text-secondary)]">Attended</div>
            </div>
            <div className="app-card p-4 text-center">
              <div className={`text-2xl font-bold ${stats.show_up_rate >= 70 ? 'text-green-600' : stats.show_up_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {stats.show_up_rate}%
              </div>
              <div className="text-sm text-[var(--text-secondary)]">Show-up Rate</div>
            </div>
          </div>
        )}

        {/* Quota progress */}
        {event.quota && stats && (
          <div className="app-card p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="font-semibold">Quota: {event.quota}</span>
              <span className={event.quota_met ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {event.quota_met ? 'Met!' : `Need ${event.quota - stats.attended} more`}
              </span>
            </div>
            <div className="w-full bg-[var(--surface-overlay)] rounded-full h-3">
              <div
                className={`h-3 rounded-full ${event.quota_met ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${Math.min((stats.attended / event.quota) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Attendee List */}
        <h2 className="app-section-title text-xl mb-4">Attendees ({attendees.length})</h2>
        <div className="app-card overflow-hidden">
          {attendees.map((a) => (
            <div key={a.rsvp_id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
              <div>
                <span className="font-medium text-[var(--text-primary)]">{a.print_name}</span>
                <span className="text-sm text-[var(--text-secondary)] ml-2">{a.village}</span>
              </div>
              <div className="flex items-center gap-2">
                {a.attended ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" /> Checked in
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[var(--text-muted)] text-sm">
                    <XCircle className="w-4 h-4" /> Not yet
                  </span>
                )}
              </div>
            </div>
          ))}
          {attendees.length === 0 && (
            <div className="px-4 py-8 text-center text-[var(--text-muted)]">No attendees yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
