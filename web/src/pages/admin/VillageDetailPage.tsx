import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getVillage } from '../../lib/api';
import { ArrowLeft, MapPin } from 'lucide-react';

export default function VillageDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['village', id],
    queryFn: () => getVillage(Number(id)),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  const v = data?.village;
  if (!v) return <div className="p-8 text-center text-gray-400">Village not found</div>;

  const pct = v.quota_target > 0 ? ((v.supporter_count / v.quota_target) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6" /> {v.name}
          </h1>
          <p className="text-blue-200 text-sm">{v.region} · {v.registered_voters.toLocaleString()} registered voters</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Progress */}
        <div className="bg-white rounded-xl shadow-sm p-6 border mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold">{v.supporter_count} / {v.quota_target} supporters</span>
            <span className="text-lg font-bold">{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full ${Number(pct) >= 75 ? 'bg-green-500' : Number(pct) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Number(pct), 100)}%` }}
            />
          </div>
        </div>

        {/* Precincts */}
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Precincts</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {v.precincts.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 border">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold text-gray-800">Precinct {p.number}</span>
                  <span className="text-sm text-gray-500 ml-2">({p.alpha_range})</span>
                </div>
                <span className="text-sm text-gray-600">{p.supporter_count} supporters</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{p.polling_site} · {p.registered_voters} voters</p>
            </div>
          ))}
        </div>

        {/* Blocks */}
        {v.blocks.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Blocks</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {v.blocks.map((b: any) => (
                <div key={b.id} className="bg-white rounded-xl shadow-sm p-4 border">
                  <span className="font-medium text-gray-800">{b.name}</span>
                  <span className="text-sm text-gray-500 ml-2">{b.supporter_count} supporters</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
