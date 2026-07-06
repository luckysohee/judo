import { useCallback, useEffect, useState } from "react";
import {
  HOME_ONBOARDING_STEPS,
  isHomeOnboardingCompleted,
  markHomeOnboardingCompleted,
} from "../utils/homeOnboardingCoach";

/**
 * @param {{ enabled?: boolean }} opts
 */
export function useHomeOnboardingCoach({ enabled = true } = {}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return undefined;
    }
    if (isHomeOnboardingCompleted()) return undefined;

    let cancelled = false;
    let startTimer = null;
    let pollTimer = null;

    const tryOpen = () => {
      if (cancelled || isHomeOnboardingCompleted()) return;
      startTimer = window.setTimeout(() => {
        if (!cancelled && !isHomeOnboardingCompleted()) setOpen(true);
      }, 500);
    };

    const onSplashHidden = () => {
      if (cancelled) return;
      tryOpen();
    };

    if (typeof window !== "undefined" && window.__judoSplashHidden) {
      tryOpen();
    } else if (typeof window !== "undefined") {
      window.addEventListener("judo:splash-hidden", onSplashHidden, { once: true });
      pollTimer = window.setInterval(() => {
        if (typeof window !== "undefined" && window.__judoSplashHidden) {
          window.clearInterval(pollTimer);
          pollTimer = null;
          tryOpen();
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (startTimer != null) window.clearTimeout(startTimer);
      if (pollTimer != null) window.clearInterval(pollTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("judo:splash-hidden", onSplashHidden);
      }
    };
  }, [enabled]);

  const finish = useCallback(() => {
    markHomeOnboardingCompleted();
    setOpen(false);
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const next = useCallback(() => {
    if (stepIndex >= HOME_ONBOARDING_STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, finish]);

  return {
    open,
    stepIndex,
    step: HOME_ONBOARDING_STEPS[stepIndex] ?? null,
    stepCount: HOME_ONBOARDING_STEPS.length,
    next,
    skip,
  };
}
