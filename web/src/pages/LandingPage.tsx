import { Link } from 'react-router-dom';
import { Users, BarChart3, ClipboardList } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B3A6B] to-[#0f2340] text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Josh & Tina 2026
          </h1>
          <p className="text-xl md:text-2xl text-blue-200 mb-2">
            Campaign Supporter Tracker
          </p>
          <p className="text-lg text-blue-300">
            Together, we build a stronger Guam
          </p>
        </div>

        {/* CTA */}
        <div className="text-center mb-16">
          <Link
            to="/signup"
            className="inline-block bg-[#C41E3A] hover:bg-[#a01830] text-white text-xl font-bold px-10 py-4 rounded-xl shadow-lg transition-all hover:scale-105"
          >
            Sign Up to Support Josh & Tina
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-blue-200" />
            <h3 className="text-lg font-semibold mb-2">Track Supporters</h3>
            <p className="text-blue-200 text-sm">
              Digital sign-up forms replace paper blue forms. Every supporter counted.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-blue-200" />
            <h3 className="text-lg font-semibold mb-2">Live Dashboard</h3>
            <p className="text-blue-200 text-sm">
              See village-by-village progress toward goals in real time.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-blue-200" />
            <h3 className="text-lg font-semibold mb-2">Event Check-in</h3>
            <p className="text-blue-200 text-sm">
              Track motorcade and rally attendance. Know who shows up.
            </p>
          </div>
        </div>

        {/* Admin link */}
        <div className="text-center">
          <Link
            to="/admin"
            className="text-blue-300 hover:text-white text-sm underline"
          >
            Staff Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
