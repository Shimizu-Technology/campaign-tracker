import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, Users, Zap, DollarSign, CheckCircle, AlertTriangle, Phone } from 'lucide-react';
import { getSmsStatus, sendTestSms, sendSmsBlast, getEvents, sendEventNotify } from '../../lib/api';

type Tab = 'blast' | 'event' | 'test';

export default function SmsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('blast');

  const { data: smsStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['smsStatus'],
    queryFn: getSmsStatus,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => getEvents(),
  });

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg">Loading SMS status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-green-400" />
            <div>
              <h1 className="text-xl font-bold">SMS Center</h1>
              <p className="text-blue-200 text-sm">Send texts to supporters</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Status Banner */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <Zap className={`w-5 h-5 mx-auto mb-1 ${smsStatus?.configured ? 'text-green-500' : 'text-red-500'}`} />
              <div className="text-xs text-gray-500">Status</div>
              <div className={`text-sm font-semibold ${smsStatus?.configured ? 'text-green-700' : 'text-red-700'}`}>
                {smsStatus?.configured ? 'Active' : 'Not Configured'}
              </div>
            </div>
            <div>
              <DollarSign className="w-5 h-5 mx-auto mb-1 text-gray-400" />
              <div className="text-xs text-gray-500">Balance</div>
              <div className="text-sm font-semibold text-gray-900">
                {smsStatus?.balance != null ? `$${smsStatus.balance.toFixed(2)}` : '—'}
              </div>
            </div>
            <div>
              <Phone className="w-5 h-5 mx-auto mb-1 text-gray-400" />
              <div className="text-xs text-gray-500">Sender</div>
              <div className="text-sm font-semibold text-gray-900">{smsStatus?.sender_id || '—'}</div>
            </div>
          </div>
        </div>

        {!smsStatus?.configured && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-800 font-medium">ClickSend not configured</p>
              <p className="text-red-600 text-sm">Add CLICKSEND_USERNAME and CLICKSEND_API_KEY to your environment variables.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {([
            { key: 'blast', label: 'Blast', icon: Users },
            { key: 'event', label: 'Event Notify', icon: Zap },
            { key: 'test', label: 'Test SMS', icon: Send },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-[#1B3A6B] text-white shadow-sm'
                  : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'blast' && <BlastTab />}
        {activeTab === 'event' && <EventTab events={eventsData?.events || []} />}
        {activeTab === 'test' && <TestTab />}
      </div>
    </div>
  );
}

function BlastTab() {
  const [message, setMessage] = useState('');
  const [villageId, setVillageId] = useState('');
  const [filters, setFilters] = useState({ motorcade: false, registered: false, yardSign: false });
  const [result, setResult] = useState<any>(null);

  const dryRunMutation = useMutation({
    mutationFn: () => sendSmsBlast({
      message,
      village_id: villageId ? Number(villageId) : undefined,
      motorcade_available: filters.motorcade ? 'true' : undefined,
      registered_voter: filters.registered ? 'true' : undefined,
      yard_sign: filters.yardSign ? 'true' : undefined,
      dry_run: 'true',
    }),
    onSuccess: (data) => setResult(data),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendSmsBlast({
      message,
      village_id: villageId ? Number(villageId) : undefined,
      motorcade_available: filters.motorcade ? 'true' : undefined,
      registered_voter: filters.registered ? 'true' : undefined,
      yard_sign: filters.yardSign ? 'true' : undefined,
    }),
    onSuccess: (data) => setResult(data),
  });

  const charCount = message.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Compose Blast Message</h3>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message to supporters..."
          className="w-full border rounded-lg p-3 h-32 text-sm resize-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
          maxLength={480}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{charCount}/480 characters</span>
          <span>{smsSegments} SMS segment{smsSegments > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Filters</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.motorcade}
              onChange={(e) => setFilters(f => ({ ...f, motorcade: e.target.checked }))}
              className="rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
            />
            Motorcade available only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.registered}
              onChange={(e) => setFilters(f => ({ ...f, registered: e.target.checked }))}
              className="rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
            />
            Registered voters only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.yardSign}
              onChange={(e) => setFilters(f => ({ ...f, yardSign: e.target.checked }))}
              className="rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
            />
            Yard sign supporters only
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => dryRunMutation.mutate()}
          disabled={!message.trim() || dryRunMutation.isPending}
          className="flex-1 bg-white border border-[#1B3A6B] text-[#1B3A6B] py-3 rounded-xl font-semibold text-sm hover:bg-blue-50 disabled:opacity-50 transition-all"
        >
          {dryRunMutation.isPending ? 'Counting...' : 'Preview (Dry Run)'}
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Send this message to ${result?.recipient_count || 'all matching'} supporters?`)) {
              sendMutation.mutate();
            }
          }}
          disabled={!message.trim() || sendMutation.isPending}
          className="flex-1 bg-[#C41E3A] text-white py-3 rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {sendMutation.isPending ? 'Sending...' : 'Send Blast'}
        </button>
      </div>

      {result && (
        <div className={`rounded-xl border p-4 ${result.dry_run ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
          {result.dry_run ? (
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-medium">
                Would send to <strong>{result.recipient_count}</strong> supporters
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-medium">Blast sent!</span>
              </div>
              <div className="text-sm text-green-700">
                Sent: {result.sent} · Failed: {result.failed} · Skipped: {result.skipped}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventTab({ events }: { events: any[] }) {
  const [selectedEvent, setSelectedEvent] = useState('');
  const [notifyType, setNotifyType] = useState('rsvp');
  const [result, setResult] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: () => sendEventNotify(Number(selectedEvent), notifyType),
    onSuccess: (data) => setResult(data),
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Event Notification</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#1B3A6B]"
            >
              <option value="">Select an event...</option>
              {events.map((event: any) => (
                <option key={event.id} value={event.id}>
                  {event.name} — {event.date} ({event.invited_count} invited)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notification Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'rsvp', label: 'RSVP Confirm' },
                { key: 'reminder', label: 'Reminder' },
                { key: 'motorcade', label: 'Motorcade' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setNotifyType(key)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                    notifyType === key
                      ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          if (window.confirm('Send notifications to all RSVPs for this event?')) {
            mutation.mutate();
          }
        }}
        disabled={!selectedEvent || mutation.isPending}
        className="w-full bg-[#1B3A6B] text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" />
        {mutation.isPending ? 'Sending...' : 'Send Notifications'}
      </button>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">Notifications sent!</span>
          </div>
          <div className="text-sm text-green-700">
            Event: {result.event} · Sent: {result.sent} · Failed: {result.failed}
          </div>
        </div>
      )}
    </div>
  );
}

function TestTab() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Test message from Campaign Tracker! 🤙');
  const [result, setResult] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: () => sendTestSms(phone, message),
    onSuccess: (data) => setResult(data),
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Send Test SMS</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 671 555 1234"
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#1B3A6B]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded-lg p-3 h-24 text-sm resize-none focus:ring-2 focus:ring-[#1B3A6B]"
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => mutation.mutate()}
        disabled={!phone.trim() || !message.trim() || mutation.isPending}
        className="w-full bg-[#1B3A6B] text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" />
        {mutation.isPending ? 'Sending...' : 'Send Test'}
      </button>

      {result && (
        <div className={`rounded-xl border p-4 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span className={result.success ? 'text-green-800' : 'text-red-800'}>
              {result.success ? `Sent! Message ID: ${result.message_id}` : `Failed: ${result.error}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
