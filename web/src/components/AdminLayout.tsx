import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import api from '../lib/api';

// Set auth token on API client whenever it changes
function AuthTokenSync({ onReady }: { onReady: () => void }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    let mounted = true;

    const syncToken = async () => {
      if (!isSignedIn) {
        delete api.defaults.headers.common['Authorization'];
        if (mounted) onReady();
        return;
      }

      const token = await getToken();
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } else {
        delete api.defaults.headers.common['Authorization'];
      }
      if (mounted) onReady();
    };

    syncToken();

    // Re-sync every 50 seconds (tokens expire after 60s)
    const interval = setInterval(syncToken, 50_000);
    return () => {
      mounted = false;
      clearInterval(interval);
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
          </div>
        </div>
      </SignedOut>
    </>
  );
}

// Export UserButton for use in headers
export { UserButton };
