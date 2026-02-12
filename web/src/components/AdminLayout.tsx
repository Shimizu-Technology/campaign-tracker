import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import api from '../lib/api';

// Set auth token on API client whenever it changes
function AuthTokenSync() {
  const { getToken } = useAuth();

  useEffect(() => {
    const syncToken = async () => {
      const token = await getToken();
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    };
    syncToken();

    // Re-sync every 50 seconds (tokens expire after 60s)
    const interval = setInterval(syncToken, 50_000);
    return () => clearInterval(interval);
  }, [getToken]);

  return null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>
        <AuthTokenSync />
        {children}
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen bg-gradient-to-br from-[#1B3A6B] to-[#0f2340] flex items-center justify-center">
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
