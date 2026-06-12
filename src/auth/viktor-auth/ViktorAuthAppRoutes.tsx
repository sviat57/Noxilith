import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { VaultLayout } from "@/components/vault/VaultLayout";
import { TimerProvider } from "@/lib/timer";
import { VaultProvider } from "@/lib/vault";
import { beginViktorAuthentication } from "@/lib/viktor-spaces-access/client";
import {
  getViktorAuthBaseUrl,
  getViktorAuthClientId,
  getViktorSpacesSpaceId,
} from "@/lib/viktor-spaces-access/config";
import {
  SPACE_CALLBACK_PATH,
  SPACE_ME_PATH,
} from "@/lib/viktor-spaces-access/constants";
import type { ViktorAuthStatus } from "@/lib/viktor-spaces-access/types";
import {
  ViktorAuthGlobalGate,
  type ViktorAuthSession,
} from "@/lib/viktor-spaces-access/ViktorAuthGlobalGate";
import { ViktorSpaceAccessProvider } from "@/lib/viktor-spaces-access/ViktorSpaceAccessProvider";
import { ArchivePage } from "@/pages/vault/ArchivePage";
import { CalendarPage } from "@/pages/vault/CalendarPage";
import { GraphPage } from "@/pages/vault/GraphPage";
import { NotesPage } from "@/pages/vault/NotesPage";
import { StatsPage } from "@/pages/vault/StatsPage";
import { TimerPage } from "@/pages/vault/TimerPage";

function toViktorSession(status: ViktorAuthStatus): ViktorAuthSession {
  if (status.status !== "allowed") {
    return null;
  }
  return {
    user: {
      id: status.user.id,
      email: status.user.email,
      name: status.user.display_name,
    },
    resource: status.resource,
  };
}

function useViktorAuthSession(enabled: boolean): ViktorAuthSession | undefined {
  const [session, setSession] = useState<ViktorAuthSession | undefined>(
    enabled ? undefined : null,
  );

  useEffect(() => {
    if (!enabled) {
      setSession(null);
      return;
    }
    let cancelled = false;
    setSession(undefined);
    void fetch(SPACE_ME_PATH, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async response => {
        if (!response.ok) return null;
        const status = (await response.json()) as ViktorAuthStatus;
        return toViktorSession(status);
      })
      .catch(() => null)
      .then(nextSession => {
        if (!cancelled) {
          setSession(nextSession);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return session;
}

export function ViktorAuthAppRoutes({
  session,
  onSignInRequired,
}: {
  session?: ViktorAuthSession;
  onSignInRequired?: () => void;
}) {
  const fetchedSession = useViktorAuthSession(session === undefined);
  const activeSession = session === undefined ? fetchedSession : session;
  const startedSignIn = useRef(false);
  const beginSignIn = useCallback(() => {
    if (startedSignIn.current) return;
    startedSignIn.current = true;
    if (onSignInRequired) {
      onSignInRequired();
      return;
    }
    const resourceId = getViktorSpacesSpaceId();
    const clientId = getViktorAuthClientId();
    const viktorAuthBaseUrl = getViktorAuthBaseUrl();
    if (!resourceId || !clientId || !viktorAuthBaseUrl) {
      return;
    }
    void beginViktorAuthentication({
      clientId,
      resourceId,
      viktorAuthBaseUrl,
      redirectUri: `${window.location.origin}${SPACE_CALLBACK_PATH}`,
    });
  }, [onSignInRequired]);

  return (
    <ViktorSpaceAccessProvider>
      <ViktorAuthGlobalGate
        session={activeSession}
        onSignInRequired={beginSignIn}
      >
        <VaultProvider>
          <TimerProvider>
            <Routes>
              <Route element={<VaultLayout />}>
                <Route path="/" element={<NotesPage />} />
                <Route path="/note/:id" element={<NotesPage />} />
                <Route path="/graph" element={<GraphPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/timer" element={<TimerPage />} />
                <Route path="/archive" element={<ArchivePage />} />
                <Route path="/stats" element={<StatsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TimerProvider>
        </VaultProvider>
      </ViktorAuthGlobalGate>
    </ViktorSpaceAccessProvider>
  );
}
