import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getEvent, getEventAttendees } from '../../lib/api';
import { ArrowLeft, CheckCircle, XCircle, ClipboardCheck } from 'lucide-react';

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

  if (!event) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/admin/events" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Events
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{event.name}</h1>
              <p className="text-blue-200 text-sm">{event.date} · {event.location} · {event.village_name || 'All villages'}</p>
            </div>
            <Link to={`/admin/events/${id}/checkin`}
              className="bg-[#C41E3A] hover:bg-[#a01830] px-4 py-2 rounded-lg font-medium flex items-center gap-1">
              <ClipboardCheck className="w-4 h-4" /> Check In
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-4 border text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total_invited}</div>
              <div className="text-sm text-gray-500">Invited</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.confirmed}</div>
              <div className="text-sm text-gray-500">Confirmed</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border text-center">
              <div className="text-2xl font-bold text-green-600">{stats.attended}</div>
              <div className="text-sm text-gray-500">Attended</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border text-center">
              <div className={`text-2xl font-bold ${stats.show_up_rate >= 70 ? 'text-green-600' : stats.show_up_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {stats.show_up_rate}%
              </div>
              <div className="text-sm text-gray-500">Show-up Rate</div>
            </div>
          </div>
        )}

        {/* Quota progress */}
        {event.quota && stats && (
          <div className="bg-white rounded-xl shadow-sm p-4 border mb-6">
            <div className="flex justify-between mb-2">
              <span className="font-semibold">Quota: {event.quota}</span>
              <span className={event.quota_met ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {event.quota_met ? 'Met!' : `Need ${event.quota - stats.attended} more`}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${event.quota_met ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${Math.min((stats.attended / event.quota) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Attendee List */}
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Attendees ({attendees.length})</h2>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {attendees.map((a) => (
            <div key={a.rsvp_id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
              <div>
                <span className="font-medium text-gray-800">{a.print_name}</span>
                <span className="text-sm text-gray-500 ml-2">{a.village}</span>
              </div>
              <div className="flex items-center gap-2">
                {a.attended ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" /> Checked in
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-400 text-sm">
                    <XCircle className="w-4 h-4" /> Not yet
                  </span>
                )}
              </div>
            </div>
          ))}
          {attendees.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400">No attendees yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
