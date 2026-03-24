import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarHeart, Heart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCampaignInfo } from '../lib/api';
import PublicWordmark from '../components/PublicWordmark';
import { FacebookIcon, InstagramIcon } from '../components/PublicSocialIcons';

export default function LandingPage() {
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
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 md:gap-4 md:px-6">
          <Link to="/" className="min-w-0">
            <PublicWordmark size="sm" />
          </Link>
          <a
            href="https://joshtina.info"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] min-w-[172px] shrink-0 items-center justify-center rounded-full border border-slate-200 px-5 text-center text-sm leading-none font-semibold text-slate-700 whitespace-nowrap transition hover:border-primary hover:text-primary md:min-w-[190px]"
          >
            Official campaign info
          </a>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-5 md:gap-10 md:px-6 md:py-12">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-4 md:space-y-5">
            <div className="inline-flex rounded-full border border-[#f1d1cf] bg-[#fff5f4] px-4 py-2 text-xs font-semibold text-[#b3271d] md:text-sm">
              Official public supporter signup
            </div>

            <div className="space-y-3 md:space-y-4">
              <h1 className="max-w-3xl text-balance text-[2.15rem] leading-[0.97] font-extrabold tracking-tight text-slate-950 sm:text-[2.6rem] sm:leading-[0.98] md:text-6xl">
                <span className="md:hidden">Support Josh &amp; Tina for Guam.</span>
                <span className="hidden md:inline">Support Josh Tenorio and Tina Muña-Barnes for Guam.</span>
              </h1>
              <div className="max-w-2xl space-y-3">
                <p className="text-[1.02rem] leading-7 text-slate-600 md:hidden">
                  Join the campaign, stay connected, and add your name as a supporter.
                </p>
                <p className="text-sm leading-6 text-slate-500 md:hidden">
                  Josh Tenorio and Tina Muña-Barnes are building a people-powered campaign across Guam.
                </p>
                <p className="hidden text-lg leading-8 text-slate-600 md:block">
                  Join the campaign, stay connected, and help us build momentum across Guam.
                  This is the official place to sign up as a supporter and hear from the campaign.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-cta px-6 text-base font-bold text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:bg-cta-hover sm:w-auto md:min-h-[52px] md:px-7"
              >
                Sign up to support
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="https://joshtina.info"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden min-h-[52px] items-center justify-center rounded-full border border-slate-200 bg-white px-7 text-base font-semibold text-slate-700 transition hover:border-primary hover:text-primary sm:inline-flex"
              >
                Learn more about the campaign
              </a>
            </div>
            <a
              href="https://joshtina.info"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-sm font-semibold text-primary underline-offset-4 transition hover:text-primary-dark hover:underline sm:hidden"
            >
              Learn more about the campaign
            </a>
          </div>

          <div className="relative hidden overflow-hidden rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-28px_rgba(15,42,91,0.35)] lg:block">
            <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-r from-primary via-[#2b67be] to-[#87bbe9]" />
            <div className="relative space-y-4 rounded-[24px] bg-[#f8fbff] p-4 pt-7 md:p-5 md:pt-8">
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-center shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Josh &amp; Tina supporter network
                </p>
              </div>
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3">
                <img
                  src="/joshtina-supporter.jpeg"
                  alt="Let's Go Guam supporter badge"
                  className="h-44 w-full object-contain md:h-56"
                />
              </div>
              <div className="rounded-[24px] bg-primary px-5 py-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
                  A people-powered campaign
                </p>
                <p className="mt-3 text-base font-semibold leading-8 md:text-lg">
                  Every signup helps the campaign identify supporters, stay connected, and organize for election season.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Heart className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-950">Show your support</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Add your name in a few moments and help the campaign understand where support is growing.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff1ef] text-cta">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-950">Stay informed</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Receive campaign updates, announcements, and other key moments as the 2026 race moves forward.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff8eb] text-[#ad7a12]">
              <CalendarHeart className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-950">Join campaign activity</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Raise your hand for motorcades, events, and other moments where supporters help drive momentum.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 text-sm md:grid-cols-3 md:px-6">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Get in touch</h3>
            <a href="mailto:support@joshtina.info" className="mt-3 inline-block font-semibold text-primary hover:text-primary-dark">
              support@joshtina.info
            </a>
          </div>

          {(campaignInfo?.instagram_url || campaignInfo?.facebook_url) && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Connect</h3>
              <div className="mt-3 flex flex-wrap gap-4">
                {campaignInfo?.instagram_url && (
                  <a
                    href={campaignInfo.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-semibold text-slate-700 hover:text-primary"
                  >
                    <InstagramIcon className="h-4 w-4" />
                    Instagram
                  </a>
                )}
                {campaignInfo?.facebook_url && (
                  <a
                    href={campaignInfo.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-semibold text-slate-700 hover:text-primary"
                  >
                    <FacebookIcon className="h-4 w-4" />
                    Facebook
                  </a>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mail-in donations</h3>
            <p className="mt-3 leading-6 text-slate-600">
              PO Box 11031
              <br />
              Tamuning, Guam 96910
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 px-4 py-5 text-center text-[11px] text-slate-500 md:px-6">
          Tenorio Muna-Barnes for Guam &middot; Treasurer: Antoinette &ldquo;Toni&rdquo; Sanford &middot; PO Box 11031, Tamuning, Guam 96910
          <div className="mt-2">
            <Link to="/staff" className="font-semibold text-slate-400 transition hover:text-primary">
              Staff portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
