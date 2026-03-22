import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { Link, Navigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { resolvePreferredRoute } from '../lib/workspaceRouting';

export default function StaffPortalPage() {
  const { data: sessionData, isLoading } = useSession();
  const destination = sessionData ? resolvePreferredRoute(sessionData) : '/admin';

  return (
    <>
      <SignedIn>
        {isLoading ? (
          <div className="min-h-screen flex items-center justify-center bg-(--surface-bg)">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-[3px] border-(--border-soft) border-t-blue-500 rounded-full animate-spin" />
              <div className="text-(--text-muted) text-sm">Loading your workspace...</div>
            </div>
          </div>
        ) : (
          <Navigate to={destination} replace />
        )}
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen bg-linear-to-br from-primary to-primary-dark flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaign Tracker</h1>
            <p className="text-gray-500 mb-6">Sign in to access your staff workspace</p>
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
