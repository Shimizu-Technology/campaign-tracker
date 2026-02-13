import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvents, createEvent, getVillages } from '../../lib/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Calendar, MapPin, Users, X } from 'lucide-react';

interface EventForm {
  name: string;
  event_type: string;
  date: string;
  time: string;
  location: string;
  description: string;
  village_id: string;
  quota: string;
}

interface VillageOption {
  id: number;
  name: string;
}

interface EventItem {
  id: number;
  name: string;
  event_type: string;
  date: string;
  location?: string;
  village_name?: string;
  attended_count: number;
  invited_count: number;
  quota?: number;
  show_up_rate: number;
}

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<EventForm>({
    name: '', event_type: 'motorcade', date: '', time: '', location: '',
    description: '', village_id: '', quota: '',
  });

  const { data: eventsData } = useQuery({ queryKey: ['events'], queryFn: () => getEvents() });
  const { data: villageData } = useQuery({ queryKey: ['villages'], queryFn: getVillages });

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowCreate(false);
      setForm({ name: '', event_type: 'motorcade', date: '', time: '', location: '', description: '', village_id: '', quota: '' });
    },
  });

  const events: EventItem[] = eventsData?.events || [];
  const villages: VillageOption[] = villageData?.villages || [];

  const typeColors: Record<string, string> = {
    motorcade: 'bg-blue-100 text-blue-700',
    rally: 'bg-purple-100 text-purple-700',
    fundraiser: 'bg-green-100 text-green-700',
    meeting: 'bg-yellow-100 text-yellow-700',
    other: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Events</h1>
            <button onClick={() => setShowCreate(true)} className="bg-[#C41E3A] hover:bg-[#a01830] px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> New Event
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Create Modal */}
        {showCreate && (
          <div className="bg-white rounded-xl shadow-lg border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Event</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); create.mutate({
              ...form,
              village_id: form.village_id ? Number(form.village_id) : null,
              quota: form.quota ? Number(form.quota) : null,
            }); }} className="space-y-3">
              <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="Event name" className="w-full px-3 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.event_type} onChange={e => setForm(f => ({...f, event_type: e.target.value}))}
                  className="px-3 py-2 border rounded-lg bg-white">
                  <option value="motorcade">Motorcade</option>
                  <option value="rally">Rally</option>
                  <option value="fundraiser">Fundraiser</option>
                  <option value="meeting">Meeting</option>
                  <option value="other">Other</option>
                </select>
                <input required type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                  className="px-3 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))}
                  className="px-3 py-2 border rounded-lg" placeholder="Time" />
                <input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))}
                  className="px-3 py-2 border rounded-lg" placeholder="Location" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.village_id} onChange={e => setForm(f => ({...f, village_id: e.target.value}))}
                  className="px-3 py-2 border rounded-lg bg-white">
                  <option value="">All villages</option>
                  {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <input type="number" value={form.quota} onChange={e => setForm(f => ({...f, quota: e.target.value}))}
                  className="px-3 py-2 border rounded-lg" placeholder="Quota (min attendees)" />
              </div>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Description (optional)" />
              <button type="submit" disabled={create.isPending}
                className="w-full bg-[#1B3A6B] hover:bg-[#152e55] text-white font-bold py-3 rounded-lg">
                {create.isPending ? 'Creating...' : 'Create Event'}
              </button>
            </form>
          </div>
        )}

        {/* Events List */}
        <div className="space-y-4">
          {events.map((e) => (
            <Link key={e.id} to={`/admin/events/${e.id}`}
              className="block bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">{e.name}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[e.event_type] || typeColors.other}`}>
                  {e.event_type}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {e.date}</span>
                {e.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {e.location}</span>}
                {e.village_name && <span>{e.village_name}</span>}
              </div>
              <div className="flex items-center gap-4 text-sm mt-2">
                <span className="flex items-center gap-1 text-gray-600"><Users className="w-3.5 h-3.5" /> {e.attended_count} / {e.invited_count} attended</span>
                {e.quota && <span className="text-gray-500">Quota: {e.quota}</span>}
                <span className="text-gray-500">{e.show_up_rate}% show-up</span>
              </div>
            </Link>
          ))}
          {events.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              No events yet. Create one to start tracking attendance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
