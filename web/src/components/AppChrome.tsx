/**
 * App-wide pieces that sit outside the routes: the offline banner and per-route page titles.
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { titleForPath } from '../lib/routeTitle';
import './AppChrome.css';

/** Plans are saved on this device, so editing keeps working while offline. */
export const OfflineBanner: React.FC = () => {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={16} aria-hidden="true" />
      <span>
        You're offline. Your changes are still saved on this device; live checks and AI suggestions
        come back when you reconnect.
      </span>
    </div>
  );
};

/** Sets document.title for every route change (screen readers announce it). */
export const RouteTitle: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);
  return null;
};
