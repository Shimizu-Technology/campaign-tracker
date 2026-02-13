import { useQuery } from '@tanstack/react-query';
import { getLeaderboard } from '../../lib/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, Award, TrendingUp, Users, Target } from 'lucide-react';

interface LeaderboardEntry {
  leader_code: string;
  rank: number;
  signup_count: number;
  village_name: string;
}

interface LeaderboardStats {
  total_qr_signups: number;
  active_leaders: number;
  avg_signups_per_leader: number;
  top_leader_signups: number;
}

function rankIcon(rank: number) {
  if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
  if (rank === 3) return <Award className="w-6 h-6 text-amber-600" />;
  return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-gray-400">{rank}</span>;
}

function rankBg(rank: number) {
  if (rank === 1) return 'bg-yellow-50 border-yellow-300';
  if (rank === 2) return 'bg-gray-50 border-gray-300';
  if (rank === 3) return 'bg-amber-50 border-amber-300';
  return 'bg-white border-gray-200';
}

export default function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg">Loading leaderboard...</div>
      </div>
    );
  }

  const leaderboard: LeaderboardEntry[] = data?.leaderboard || [];
  const stats: LeaderboardStats = data?.stats || {
    total_qr_signups: 0,
    active_leaders: 0,
    avg_signups_per_leader: 0,
    top_leader_signups: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Trophy className="w-7 h-7 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold">Block Leader Leaderboard</h1>
              <p className="text-blue-200 text-sm">Who's bringing in the most supporters?</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-3 border text-center">
            <Users className="w-5 h-5 mx-auto text-gray-400 mb-1" />
            <div className="text-2xl font-bold text-gray-900">{stats.total_qr_signups}</div>
            <div className="text-xs text-gray-500">QR Signups</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 border text-center">
            <Target className="w-5 h-5 mx-auto text-gray-400 mb-1" />
            <div className="text-2xl font-bold text-gray-900">{stats.active_leaders}</div>
            <div className="text-xs text-gray-500">Active Leaders</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 border text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-gray-400 mb-1" />
            <div className="text-2xl font-bold text-gray-900">{stats.avg_signups_per_leader}</div>
            <div className="text-xs text-gray-500">Avg per Leader</div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          {leaderboard.map((leader) => (
            <div
              key={leader.leader_code}
              className={`rounded-xl shadow-sm border p-4 ${rankBg(leader.rank)} transition-all`}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0">{rankIcon(leader.rank)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 truncate">
                      {leader.leader_code}
                    </span>
                    <span className="text-lg font-bold text-[#1B3A6B] ml-2">
                      {leader.signup_count}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{leader.village_name}</span>
                    <span>signups</span>
                  </div>
                </div>
              </div>
              {/* Progress bar relative to top leader */}
              {stats.top_leader_signups > 0 && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-[#1B3A6B] transition-all"
                    style={{ width: `${(leader.signup_count / stats.top_leader_signups) * 100}%` }}
                  />
                </div>
              )}
            </div>
          ))}

          {leaderboard.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              No QR code signups yet. Generate codes and start recruiting!
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/admin/qr" className="text-[#1B3A6B] hover:underline text-sm font-medium">
            Generate QR Codes →
          </Link>
        </div>
      </div>
    </div>
  );
}
