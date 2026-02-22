import { SignedIn, SignedOut, SignInButton, useAuth, useClerk } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api, { getSession } from '../lib/api';
import AdminShell from './AdminShell';

function getHttpStatus(error: unknown): number | undefined {
  const maybeAxiosError = error as { response?: { status?: number } };
  return maybeAxiosError.response?.status;
}

function isAuthError(error: unknown): boolean {
  const status = getHttpStatus(error);
  return status === 401 || status === 403;
}

function hasSufficientTokenLifetime(authHeader: string, minimumSecondsRemaining = 5): boolean {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(payloadBase64.padEnd(payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4), '='));
    const payload = JSON.parse(decodedPayload) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp - nowSeconds > minimumSecondsRemaining;
  } catch {
    return false;
  }
}

// Set auth token on API client whenever it changes
function AuthTokenSync({ onReady }: { onReady: () => void }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const syncInFlightRef = useRef(false);
  const syncPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    let mounted = true;

    const syncToken = async () => {
      if (syncInFlightRef.current) {
        if (syncPromiseRef.current) {
          await syncPromiseRef.current;
        }
        if (mounted) onReady();
        return;
      }

      syncInFlightRef.current = true;
      const run = async () => {
        if (!isSignedIn) {
          delete api.defaults.headers.common['Authorization'];
          return;
        }

        try {
          const token = await getToken();
          if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          }
          // Guard against transient Clerk token null/refresh windows:
          // keep existing Authorization header rather than clearing it.
        } catch (error) {
          // Keep previous Authorization header on transient token-sync failures.
          console.warn('[AuthTokenSync] token refresh failed', error);
        }
      };

      syncPromiseRef.current = run();
      await syncPromiseRef.current;
      syncPromiseRef.current = null;
      syncInFlightRef.current = false;

      if (mounted) onReady();
    };

    void syncToken();

    // Keep token warm on a short interval.
    const interval = setInterval(() => {
      void syncToken();
    }, 20_000);
    const onFocus = () => {
      void syncToken();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncToken();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const interceptorId = api.interceptors.request.use(async (config) => {
      if (!isSignedIn) return config;

      const headers = config.headers as { Authorization?: string; authorization?: string } | undefined;
      const existingAuthHeader =
        headers?.Authorization ||
        headers?.authorization ||
        (api.defaults.headers.common['Authorization'] as string | undefined);

      if (
        typeof existingAuthHeader === 'string' &&
        existingAuthHeader.startsWith('Bearer ') &&
        hasSufficientTokenLifetime(existingAuthHeader)
      ) {
        return config;
      }

      try {
        const token = await getToken();
        if (token) {
          config.headers = config.headers || {};
          (config.headers as { Authorization?: string }).Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.warn('[AuthTokenSync] request token attach failed', error);
      }
      return config;
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      api.interceptors.request.eject(interceptorId);
    };
  }, [getToken, isLoaded, isSignedIn, onReady]);

  return null;
}

function AuthorizedContent({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const [sessionState, setSessionState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const checkSession = async () => {
      try {
        // Use fetchQuery so the result is cached under ['session'] —
        // this eliminates the duplicate /session call from useSession()
        await queryClient.fetchQuery({
          queryKey: ['session'],
          queryFn: getSession,
          staleTime: 60_000,
          // Keep this gate snappy. Long retry backoff here is perceived as
          // "admin page is frozen" while showing Verifying access.
          retry: (failureCount, error) => !isAuthError(error) && failureCount < 1,
        });
        setSessionState('authorized');
      } catch (error) {
        if (isAuthError(error)) {
          setSessionState('unauthorized');
        } else {
          // Network error or server error — retry
          setSessionState('authorized'); // Allow through, backend will handle
        }
      }
    };

    checkSession();
  }, [isLoaded, isSignedIn, queryClient]);

  if (sessionState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[var(--border-soft)] border-t-blue-500 rounded-full animate-spin" />
          <div className="text-[var(--text-muted)] text-sm">Verifying access...</div>
        </div>
      </div>
    );
  }

  if (sessionState === 'unauthorized') {
    return (
      <div className="min-h-screen bg-linear-to-br from-primary to-primary-dark flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">
            Your account is not authorized to access this application. Please contact the campaign admin to request access.
          </p>
          <button
            onClick={() => signOut({ redirectUrl: '/admin' })}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl text-lg transition-all"
          >
            Sign Out &amp; Switch Account
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full mt-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-lg transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);

  return (
    <>
      <SignedIn>
        <AuthTokenSync onReady={() => setAuthReady(true)} />
        {authReady ? (
          <AuthorizedContent>{children}</AuthorizedContent>
        ) : (
          <div className="min-h-screen flex items-center justify-center bg-[var(--surface-bg)]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-[3px] border-[var(--border-soft)] border-t-blue-500 rounded-full animate-spin" />
              <div className="text-[var(--text-muted)] text-sm">Loading...</div>
            </div>
          </div>
        )}
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen bg-linear-to-br from-primary to-primary-dark flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaign Tracker</h1>
            <p className="text-gray-500 mb-6">Sign in to access the staff dashboard</p>
            <SignInButton mode="modal">
              <button className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl text-lg transition-all">
                Sign In
              </button>
            </SignInButton>
            <p className="text-xs text-gray-400 mt-4">
              Contact your campaign admin for an account
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center justify-center text-sm text-primary hover:text-primary-dark font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </SignedOut>
    </>
  );
}

// AdminShell handles the UserButton in the sidebar
