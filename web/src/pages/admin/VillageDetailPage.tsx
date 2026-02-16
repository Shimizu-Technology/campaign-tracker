import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getVillage } from '../../lib/api';
import { ArrowLeft, MapPin, Info } from 'lucide-react';

interface PrecinctDetail {
  id: number;
  number: string;
  alpha_range: string;
  supporter_count: number;
  polling_site: string;
  registered_voters: number;
}

interface BlockDetail {
  id: number;
  name: string;
  supporter_count: number;
}

interface VillageDetail {
  name: string;
  region: string;
  registered_voters: number;
  supporter_count: number;
  quota_target: number;
  unassigned_precinct_count: number;
  precincts: PrecinctDetail[];
  blocks: BlockDetail[];
}

function supporterLabel(count: number) {
  return `${count} supporter${count === 1 ? '' : 's'}`;
}

export default function VillageDetailPage() {
  const { id } = useParams();
  const returnTo = `/admin/villages/${id}`;
  const { data, isLoading } = useQuery({
    queryKey: ['village', id],
    queryFn: () => getVillage(Number(id)),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">Loading...</div>;

  const v: VillageDetail | undefined = data?.village;
  if (!v) return <div className="p-8 text-center text-[var(--text-muted)]">Village not found</div>;

  const pct = v.quota_target > 0 ? ((v.supporter_count / v.quota_target) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <MapPin className="w-6 h-6 text-[#1B3A6B]" /> {v.name}
        </h1>
        <p className="text-gray-500 text-sm">{v.region} · {v.registered_voters.toLocaleString()} registered voters (GEC Jan 2026)</p>
      </div>

      <div>
        {/* Progress */}
        <div className="app-card p-6 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold">{v.supporter_count} / {v.quota_target} supporters</span>
            <span className="text-lg font-bold">{pct}%</span>
          </div>
          <div className="w-full bg-[var(--surface-overlay)] rounded-full h-4">
            <div
              className={`h-4 rounded-full ${Number(pct) >= 75 ? 'bg-green-500' : Number(pct) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Number(pct), 100)}%` }}
            />
          </div>
          <div className="flex items-start gap-2 mt-3 text-xs text-[var(--text-secondary)]">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              <strong>Supporters</strong> are people who signed up through our campaign.{' '}
              <strong>Registered voters</strong> ({v.registered_voters.toLocaleString()}) is the total voter count from the Guam Election Commission (Jan 2026).{' '}
              The quota target ({v.quota_target.toLocaleString()}) is the number of supporters we aim to reach in this village.
            </p>
          </div>
        </div>

        {/* Precincts */}
        <h2 className="app-section-title text-xl mb-4">Precincts</h2>
        {v.unassigned_precinct_count > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-800 rounded-xl p-3 mb-4 text-sm">
            {v.unassigned_precinct_count} supporter{v.unassigned_precinct_count > 1 ? "s are" : " is"} in this village without a precinct assignment.
            {" "}
            <Link
              to={`/admin/supporters?village_id=${id}&unassigned_precinct=true&return_to=${encodeURIComponent(returnTo)}`}
              className="underline font-medium hover:text-yellow-900"
            >
              View and assign
            </Link>
            .
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {v.precincts.map((p) => (
            <Link
              key={p.id}
              to={`/admin/supporters?village_id=${id}&precinct_id=${p.id}&return_to=${encodeURIComponent(returnTo)}`}
              className="app-card p-4 block hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Precinct {p.number}</span>
                  <span className="text-sm text-[var(--text-secondary)] ml-2">({p.alpha_range})</span>
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{supporterLabel(p.supporter_count)}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{p.polling_site} · {p.registered_voters} registered voters (GEC)</p>
            </Link>
          ))}
        </div>

        {/* Blocks */}
        {v.blocks.length > 0 && (
          <>
            <h2 className="app-section-title text-xl mb-4">Blocks</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {v.blocks.map((b) => (
                <div key={b.id} className="app-card p-4">
                  <span className="font-medium text-[var(--text-primary)]">{b.name}</span>
                  <span className="text-sm text-[var(--text-secondary)] ml-2">{supporterLabel(b.supporter_count)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
