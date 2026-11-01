import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WelcomeBackDialog } from '../components/WelcomeBackDialog';
import { MY_PLANS_ROUTE, NEW_PLAN_ROUTE, getStartPlanningAction } from './navigation';

/**
 * Shared "Start planning" behaviour: a browser with no saved plans goes straight to the wizard;
 * one with saved plans gets the Welcome back dialog. Render `welcomeBackDialog` once.
 * `beforeNavigate` runs just before leaving the page (e.g. to close a drawer).
 */
export function useStartPlanning(beforeNavigate?: () => void) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const checking = useRef(false);

  const go = useCallback(
    (route: string) => {
      setOpen(false);
      beforeNavigate?.();
      navigate(route);
    },
    [beforeNavigate, navigate],
  );

  const startPlanning = useCallback(async () => {
    // Repeated clicks while storage is being read are ignored.
    if (checking.current || open) return;
    checking.current = true;
    try {
      if ((await getStartPlanningAction()) === 'welcome-back') setOpen(true);
      else go(NEW_PLAN_ROUTE);
    } finally {
      checking.current = false;
    }
  }, [go, open]);

  const welcomeBackDialog = (
    <WelcomeBackDialog
      isOpen={open}
      onClose={() => setOpen(false)}
      onViewPlans={() => go(MY_PLANS_ROUTE)}
      onStartNew={() => go(NEW_PLAN_ROUTE)}
    />
  );

  return { startPlanning, welcomeBackDialog };
}
