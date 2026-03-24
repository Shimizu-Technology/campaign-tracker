import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, Home, Share2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCampaignInfo } from '../lib/api';
import PublicWordmark from '../components/PublicWordmark';

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
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="bg-primary px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.24em] text-white">
        Building Guam&apos;s Future Together
      </div>

      <div className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link to="/" className="min-w-0">
            <PublicWordmark size="sm" />
          </Link>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 md:gap-10 md:px-6 md:py-12">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#fff1ef] text-cta">
              <Heart className="h-8 w-8" />
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 md:text-6xl">
                Si Yu&apos;os Ma&apos;åse!
              </h1>
              <p className="text-xl font-semibold text-primary md:text-2xl">
                Thank you for supporting Josh &amp; Tina.
              </p>
              <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                Your signup helps the campaign understand support across Guam and stay connected with people who want to be part of the movement.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-white transition hover:bg-primary-dark"
              >
                <Home className="h-4 w-4" />
                Back to home
              </Link>
              <Link
                to="/signup"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 text-base font-semibold text-slate-700 transition hover:border-primary hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Submit another response
              </Link>
            </div>

            {(campaignInfo?.instagram_url || campaignInfo?.facebook_url || campaignInfo?.tiktok_url || campaignInfo?.twitter_url) && (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900">
                  <Share2 className="h-5 w-5 text-primary" />
                  <p className="font-semibold">Follow the campaign</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {campaignInfo?.instagram_url && (
                    <a
                      href={campaignInfo.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:text-primary"
                    >
                      <InstagramIcon className="h-5 w-5" />
                      Instagram
                    </a>
                  )}
                  {campaignInfo?.facebook_url && (
                    <a
                      href={campaignInfo.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:text-primary"
                    >
                      <FacebookIcon className="h-5 w-5" />
                      Facebook
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-28px_rgba(15,42,91,0.22)]">
              <img
                src="/joshtina-thank-you.avif"
                alt="Thank you for supporting Josh and Tina"
                className="h-full w-full rounded-[24px] object-cover"
              />
            </div>

            <div className="rounded-[28px] border border-[#f0d9a4] bg-[#fff9ec] p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#93650d]">
                Supporter next step
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                If you opted in for updates, the campaign may reach out with announcements,
                volunteer opportunities, and event information.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
