import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvent, getEventAttendees, checkInAttendee } from '../../lib/api';
import { ArrowLeft, Search, CheckCircle, Loader2, Users } from 'lucide-react';

export default function CheckInPage() {
  const { id } = useParams();
  const eventId = Number(id);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: eventData } = useQuery({ queryKey: ['event', id], queryFn: () => getEvent(eventId) });
  const { data: attendeeData, refetch } = useQuery({
    queryKey: ['attendees', id, search],
    queryFn: () => getEventAttendees(eventId, search || undefined),
    refetchInterval: 5000,
  });

  const checkIn = useMutation({
    mutationFn: (supporterId: number) => checkInAttendee(eventId, supporterId),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
  });

  const event = eventData?.event;
  const stats = attendeeData?.stats;
  const attendees = attendeeData?.attendees || [];

  if (!event) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="bg-[#1B3A6B] text-white py-4 px-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <Link to={`/admin/events/${id}`} className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Event Detail
          </Link>
          <h1 className="text-lg font-bold">{event.name} — Check In</h1>

          {/* Live Counter */}
          {stats && (
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-blue-200" />
                <span className="text-2xl font-bold">{stats.attended}</span>
                <span className="text-blue-200">/ {event.quota || stats.total_invited}</span>
              </div>
              <div className={`px-2 py-0.5 rounded text-sm font-medium ${
                event.quota && stats.attended >= event.quota ? 'bg-green-500' : 'bg-yellow-500 text-black'
              }`}>
                {event.quota && stats.attended >= event.quota ? 'QUOTA MET!' : `${event.quota ? event.quota - stats.attended : '—'} more needed`}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mt-3">
            <Search className="w-5 h-5 absolute left-3 top-3 text-blue-300" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search supporter name..."
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 text-lg focus:ring-2 focus:ring-white/30 focus:border-transparent"
            />
          </div>
        </div>
      </header>

      {/* Attendee List */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {attendees.map((a: any) => (
          <div key={a.rsvp_id}
            className={`flex items-center justify-between p-4 mb-2 rounded-xl border ${
              a.attended ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
            }`}
          >
            <div>
              <div className="font-medium text-gray-800">{a.print_name}</div>
              <div className="text-sm text-gray-500">{a.village} · {a.contact_number}</div>
            </div>
            {a.attended ? (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">In</span>
              </div>
            ) : (
              <button
                onClick={() => checkIn.mutate(a.supporter_id)}
                disabled={checkIn.isPending}
                className="bg-[#1B3A6B] hover:bg-[#152e55] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1"
              >
                {checkIn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check In'}
              </button>
            )}
          </div>
        ))}
        {attendees.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            {search ? 'No matching supporters found' : 'No attendees for this event yet'}
          </div>
        )}
      </div>
    </div>
  );
}
