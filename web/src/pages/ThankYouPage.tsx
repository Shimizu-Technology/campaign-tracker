import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCampaignInfo } from '../lib/api';

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

export default function ThankYouPage() {
  const { data: campaignInfo } = useQuery({
    queryKey: ['campaignInfo'],
    queryFn: getCampaignInfo,
    staleTime: 300_000,
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-primary to-primary-dark text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-6 py-10">
        <Heart className="w-16 h-16 mx-auto mb-5 text-cta" />
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Si Yu'os Ma'åse!
        </h1>
        <p className="text-xl text-blue-100 mb-2">
          Thank you for supporting Josh & Tina!
        </p>
        <p className="text-blue-200 mb-6">
          Together, we'll build a stronger Guam. We'll be in touch!
        </p>

        {/* Social Media CTA */}
        {(campaignInfo?.instagram_url || campaignInfo?.facebook_url || campaignInfo?.tiktok_url || campaignInfo?.twitter_url) && (
        <div className="mb-8">
          <p className="text-sm text-blue-300 mb-3">Follow the campaign</p>
          <div className="flex items-center justify-center gap-4">
            {campaignInfo?.instagram_url && (
            <a
              href={campaignInfo.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
            >
              <InstagramIcon className="w-5 h-5" />
              Instagram
            </a>
            )}
            {campaignInfo?.facebook_url && (
            <a
              href={campaignInfo.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
            >
              <FacebookIcon className="w-5 h-5" />
              Facebook
            </a>
            )}
          </div>
        </div>
        )}

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white bg-white/10 px-4 py-2 rounded-xl min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
