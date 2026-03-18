import { useAuth } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { capturePageview, identifyStaffUser, isAnalyticsEnabled, resetAnalytics } from '../lib/analytics';

export default function AnalyticsTracker() {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: sessionData } = useSession();
  const lastPageKeyRef = useRef('');
  const identifiedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAnalyticsEnabled) return;

    const pageKey = `${location.pathname}${location.search}`;
    if (lastPageKeyRef.current === pageKey) return;

    lastPageKeyRef.current = pageKey;
    capturePageview(location.pathname, location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isAnalyticsEnabled || !isLoaded) return;

    if (!isSignedIn || !sessionData?.user) {
      if (identifiedUserRef.current) {
        resetAnalytics();
        identifiedUserRef.current = null;
      }
      return;
    }

    const identifyKey = `${sessionData.user.id}:${sessionData.user.role}`;
    if (identifiedUserRef.current === identifyKey) return;

    identifyStaffUser(sessionData.user);
    identifiedUserRef.current = identifyKey;
  }, [isLoaded, isSignedIn, sessionData]);

  return null;
}
