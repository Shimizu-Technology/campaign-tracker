import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

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

  useEffect(() => {
    if (!isLoaded) return;

    let mounted = true;

    const syncToken = async () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;

      if (!isSignedIn) {
        delete api.defaults.headers.common['Authorization'];
        if (mounted) onReady();
        syncInFlightRef.current = false;
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

      if (mounted) onReady();
      syncInFlightRef.current = false;
    };

    syncToken();

    // Keep token warm on a short interval.
    const interval = setInterval(syncToken, 20_000);
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);

  return (
    <>
      <SignedIn>
        <AuthTokenSync onReady={() => setAuthReady(true)} />
        {authReady ? (
          children
        ) : (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-gray-400 text-lg">Loading session...</div>
          </div>
        )}
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen bg-linear-to-br from-[#1B3A6B] to-[#0f2340] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaign Tracker</h1>
            <p className="text-gray-500 mb-6">Sign in to access the staff dashboard</p>
            <SignInButton mode="modal">
              <button className="w-full bg-[#1B3A6B] hover:bg-[#152e55] text-white font-bold py-3 rounded-xl text-lg transition-all">
                Sign In
              </button>
            </SignInButton>
            <p className="text-xs text-gray-400 mt-4">
              Contact your campaign admin for an account
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center justify-center text-sm text-[#1B3A6B] hover:text-[#152e55] font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </SignedOut>
    </>
  );
}

// Export UserButton for use in headers
export { UserButton };
