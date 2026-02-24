import { Link } from 'react-router-dom';
import { Users, BarChart3, CalendarHeart, Heart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getStats, getCampaignInfo } from '../lib/api';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export default function LandingPage() {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 60_000,
  });

  const { data: campaignInfo } = useQuery({
    queryKey: ['campaignInfo'],
    queryFn: getCampaignInfo,
    staleTime: 300_000,
  });

  const totalSupporters = data?.total_supporters || 0;

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-primary to-primary-dark text-white">
      {/* Main Content */}
      <div className="flex-1 max-w-5xl mx-auto px-4 py-8 md:py-12 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-lg md:text-xl font-bold tracking-tight">Josh & Tina 2026</p>
            <p className="text-xs text-blue-200/80">For Governor & Lt. Governor of Guam</p>
          </div>
          <Link
            to="/admin"
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium min-h-[44px] flex items-center transition-colors"
          >
            Staff Dashboard
          </Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
            Josh & Tina 2026
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-2 font-medium">
            Campaign Supporter Tracker
          </p>
          <p className="text-base md:text-lg text-blue-200/90 max-w-2xl mx-auto leading-relaxed">
            Join a people-powered campaign movement for Guam. Sign up to support,
            stay informed, and help us build momentum.
          </p>
          {totalSupporters > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur px-5 py-2.5 rounded-full border border-white/10">
              <Users className="w-4 h-4 text-blue-200" />
              <span className="text-xl font-bold">{totalSupporters.toLocaleString()}</span>
              <span className="text-blue-200 text-sm">supporters and counting</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="text-center mb-12">
          <Link
            to="/signup"
            className="inline-block bg-cta hover:bg-cta-hover text-white text-lg font-semibold px-10 py-4 rounded-2xl shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Sign Up to Support Josh & Tina
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-5 mb-12">
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur p-6 text-center">
            <Heart className="w-10 h-10 mx-auto mb-4 text-blue-200" />
            <h3 className="text-xl font-semibold mb-2">Show Your Support</h3>
            <p className="text-blue-100/90 text-sm leading-relaxed">
              Add your name in seconds and let the campaign know you are with Josh and Tina.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur p-6 text-center">
            <BarChart3 className="w-10 h-10 mx-auto mb-4 text-blue-200" />
            <h3 className="text-xl font-semibold mb-2">Stay Informed</h3>
            <p className="text-blue-100/90 text-sm leading-relaxed">
              Receive campaign updates, announcements, and key moments as election season moves forward.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur p-6 text-center">
            <CalendarHeart className="w-10 h-10 mx-auto mb-4 text-blue-200" />
            <h3 className="text-xl font-semibold mb-2">Join Events</h3>
            <p className="text-blue-100/90 text-sm leading-relaxed">
              Volunteer, attend rallies and motorcades, and help bring more voices into the campaign.
            </p>
          </div>
        </div>

        {/* Learn More Link */}
        <div className="text-center mb-8">
          <a
            href="https://joshtina.info"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-200 hover:text-white text-sm font-medium transition-colors"
          >
            Learn more about Josh & Tina at joshtina.info
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            {/* Contact */}
            <div>
              <h4 className="text-[11px] font-semibold text-blue-300/80 uppercase tracking-[0.08em] mb-3">Get in Touch</h4>
              <a href="mailto:support@joshtina.info" className="text-blue-200 hover:text-white transition-colors">
                support@joshtina.info
              </a>
            </div>

            {/* Social */}
            {(campaignInfo?.instagram_url || campaignInfo?.facebook_url || campaignInfo?.tiktok_url || campaignInfo?.twitter_url) && (
            <div>
              <h4 className="text-[11px] font-semibold text-blue-300/80 uppercase tracking-[0.08em] mb-3">Connect</h4>
              <div className="flex items-center gap-4">
                {campaignInfo?.instagram_url && (
                <a
                  href={campaignInfo.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors"
                >
                  <InstagramIcon className="w-4 h-4" />
                  Instagram
                </a>
                )}
                {campaignInfo?.facebook_url && (
                <a
                  href={campaignInfo.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors"
                >
                  <FacebookIcon className="w-4 h-4" />
                  Facebook
                </a>
                )}
              </div>
            </div>
            )}

            {/* Mailing */}
            <div>
              <h4 className="text-[11px] font-semibold text-blue-300/80 uppercase tracking-[0.08em] mb-3">Mail-In Donations</h4>
              <p className="text-blue-200">
                PO Box 11031<br />
                Tamuning, Guam 96910
              </p>
            </div>
          </div>

          {/* Legal */}
          <div className="mt-6 pt-4 border-t border-white/5 text-[11px] text-blue-300/50 text-center">
            Tenorio Muna-Barnes for Guam &middot; Treasurer: Antoinette &ldquo;Toni&rdquo; Sanford &middot; PO Box 11031, Tamuning, Guam 96910
          </div>
        </div>
      </footer>
    </div>
  );
}
