import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '../../lib/api';
import { Save, RotateCcw, MessageSquare, Info } from 'lucide-react';

interface SettingsData {
  welcome_sms_template: string;
  welcome_sms_preview: string;
  available_variables: string[];
}

export default function SmsSettingsPage() {
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Use server value until user starts editing
  const displayTemplate = template ?? settings?.welcome_sms_template ?? '';

  const saveMutation = useMutation({
    mutationFn: (newTemplate: string) => updateSettings({ welcome_sms_template: newTemplate }),
    onSuccess: (data: SettingsData) => {
      queryClient.setQueryData(['settings'], data);
      setTemplate(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => updateSettings({ welcome_sms_template: '' }),
    onSuccess: (data: SettingsData) => {
      queryClient.setQueryData(['settings'], data);
      setTemplate(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const charCount = displayTemplate.length;
  const smsSegments = charCount <= 160 ? 1 : Math.ceil(charCount / 153);
  const hasChanges = template !== null && settings && template !== settings.welcome_sms_template;

  // Live preview with sample data
  const previewText = displayTemplate
    .replace(/\{first_name\}/g, 'Maria')
    .replace(/\{last_name\}/g, 'Cruz')
    .replace(/\{village\}/g, 'Tamuning');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-[var(--text-muted)] text-sm font-medium">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">SMS Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Welcome SMS Template */}
        <div className="app-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#1B3A6B]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Welcome SMS Template</h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            This message is sent automatically when a new supporter signs up (if they opt in to text messages).
          </p>

          {/* Variables */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">Available variables</p>
                <p className="text-sm text-blue-700 mt-1">
                  Click to insert: {settings?.available_variables.map((v) => (
                    <button
                      key={v}
                      onClick={() => setTemplate((prev) => (prev ?? settings?.welcome_sms_template ?? '') + `{${v}}`)}
                      className="inline-block bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-xs font-mono mr-1.5 mb-1"
                    >
                      {`{${v}}`}
                    </button>
                  ))}
                </p>
              </div>
            </div>
          </div>

          {/* Editor */}
          <div>
            <textarea
              value={displayTemplate}
              onChange={(e) => setTemplate(e.target.value)}
              rows={4}
              maxLength={320}
              className="w-full border border-[var(--border-soft)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent resize-none"
              placeholder="Enter your welcome SMS template..."
            />
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${charCount > 160 ? 'text-amber-600' : 'text-[var(--text-muted)]'}`}>
                {charCount}/320 chars · {smsSegments} SMS segment{smsSegments !== 1 ? 's' : ''}
              </span>
              {charCount > 160 && (
                <span className="text-xs text-amber-600">
                  Messages over 160 chars use multiple segments (higher cost)
                </span>
              )}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">Preview</p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{previewText || '(empty)'}</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">Sample: Maria Cruz from Tamuning</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => saveMutation.mutate(displayTemplate)}
              disabled={saveMutation.isPending || !hasChanges}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#15305a] disabled:opacity-50 text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Template'}
            </button>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-overlay)] text-[var(--text-primary)] rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Default
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">Saved!</span>
            )}
          </div>

          {saveMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
              {(saveMutation.error as Error)?.message || 'Failed to save. Please try again.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
