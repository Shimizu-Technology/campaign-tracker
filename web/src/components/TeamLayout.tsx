import { SignedIn, SignedOut, SignInButton, useAuth, useClerk } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api, { getSession } from '../lib/api';
import TeamShell from './TeamShell';
import { useSession } from '../hooks/useSession';
import { Shield } from 'lucide-react';

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

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { session } = useClerk();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const interceptorRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Install Axios request interceptor for auth
    interceptorRef.current = api.interceptors.request.use(
      async (config) => {
        // Skip if already has a valid token
        const existing = config.headers?.Authorization as string | undefined;
        if (existing && hasSufficientTokenLifetime(existing)) return config;

        try {
          const token = await getToken();
          if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (err) {
          if (!isAuthError(err)) throw err;
          // Token refresh failed — try getting a new session
          try {
            const freshSession = await session?.reload();
            if (freshSession) {
              const token = await getToken();
              if (token) {
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${token}`;
              }
            }
          } catch {
            // Give up
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    setReady(true);

    return () => {
      if (interceptorRef.current !== null) {
        api.interceptors.request.eject(interceptorRef.current);
      }
    };
  }, [getToken, session]);

  // Pre-fetch session data
  useEffect(() => {
    if (ready) {
      queryClient.prefetchQuery({ queryKey: ['session'], queryFn: getSession });
    }
  }, [ready, queryClient]);

  return (
    <>
      <SignedIn>
        <TeamAccessGuard>
          <TeamShell>{children}</TeamShell>
        </TeamAccessGuard>
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm w-full text-center shadow-sm">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Data Team Portal</h1>
            <p className="text-sm text-gray-500 mb-6">Sign in to access the data team tools.</p>
            <SignInButton mode="modal">
              <button className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
    </>
  );
}

function TeamAccessGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Only campaign_admin and data_team can access /team
  const role = data?.user?.role;
  if (role !== 'campaign_admin' && role !== 'data_team') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <Shield className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-sm text-gray-500 mb-6">The Data Team portal is only available to data team members.</p>
          <Link to="/admin" className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Go to Admin Panel
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
