import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getReportsList, getVillages, downloadReport } from '../../lib/api';
import {
  FileSpreadsheet,
  Download,
  Users,
  UserX,
  ArrowRightLeft,
  GitBranch,
  BarChart3,
  CheckCircle,
  Loader2,
} from 'lucide-react';

const reportIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  support_list: Users,
  purge_list: UserX,
  transfer_list: ArrowRightLeft,
  referral_list: GitBranch,
  quota_summary: BarChart3,
};

const reportDescriptions: Record<string, string> = {
  support_list: 'All verified team-input supporters by village. One sheet per village. Includes name, DOB, phone, address, voter reg #, and verification status.',
  purge_list: 'Voters who were removed from the GEC list (deceased or purged). Includes last known village and last list date.',
  transfer_list: 'Supporters who are registered in a different village than where they were submitted. Shows submitted vs actual village with explanation.',
  referral_list: 'Supporters routed to the correct village based on GEC registration data. Shows original submission and actual registration.',
  quota_summary: 'Per-village quota progress with targets, verified counts, public signups, and overall status. Includes grand total row.',
};

export default function TeamReportsPage() {
  const [selectedVillage, setSelectedVillage] = useState('');
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  const { data: reportsList } = useQuery({ queryKey: ['reports-list'], queryFn: getReportsList });
  const { data: villages } = useQuery({ queryKey: ['villages'], queryFn: getVillages });

  const handleDownload = async (reportType: string) => {
    setDownloadingReport(reportType);
    try {
      await downloadReport(reportType, selectedVillage ? { village_id: selectedVillage } : undefined);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingReport(null);
    }
  };

  const quickStats = reportsList?.quick_stats;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate and download Excel reports for Rose and the team</p>
      </div>

      {/* Quick Stats */}
      {quickStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MiniStat label="Quota Eligible" value={quickStats.quota_eligible} />
          <MiniStat label="Total Verified" value={quickStats.total_verified} />
          <MiniStat label="Transfers" value={quickStats.transfers} />
          <MiniStat label="Purged" value={quickStats.purged_voters} />
          <MiniStat label="Unregistered" value={quickStats.unregistered} />
        </div>
      )}

      {/* Village filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Filter by village:</label>
        <select
          value={selectedVillage}
          onChange={e => setSelectedVillage(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Villages</option>
          {(villages || []).map((v: Record<string, unknown>) => (
            <option key={v.id as number} value={v.id as number}>{v.name as string}</option>
          ))}
        </select>
      </div>

      {/* Report cards */}
      <div className="space-y-3">
        {(reportsList?.available_reports || []).map((report: Record<string, unknown>) => {
          const type = report.type as string;
          const Icon = reportIcons[type] || FileSpreadsheet;
          const isDownloading = downloadingReport === type;

          return (
            <div key={type} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm">{report.name as string}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{reportDescriptions[type] || report.description as string}</p>
              </div>
              <button
                onClick={() => handleDownload(type)}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloading ? 'Generating...' : 'Download'}
              </button>
            </div>
          );
        })}
      </div>

      {/* GEC info */}
      {reportsList && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            {reportsList.gec_data_loaded ? (
              <><CheckCircle className="w-4 h-4 text-green-500" /> GEC voter data loaded (latest: {new Date(reportsList.latest_gec_list_date).toLocaleDateString()})</>
            ) : (
              <><FileSpreadsheet className="w-4 h-4 text-amber-500" /> No GEC data loaded — purge and transfer reports will be empty</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
      <div className="text-lg font-bold text-gray-900">{(value || 0).toLocaleString()}</div>
      <div className="text-[10px] text-gray-400 font-medium uppercase">{label}</div>
    </div>
  );
}
