import { Navigate, Route, Routes } from "react-router-dom";
import { VaultLayout } from "@/components/vault/VaultLayout";
import { CloudProvider } from "@/lib/cloud";
import { TimerProvider } from "@/lib/timer";
import { VaultProvider } from "@/lib/vault";
import { ArchivePage } from "@/pages/vault/ArchivePage";
import { CalendarPage } from "@/pages/vault/CalendarPage";
import { GraphPage } from "@/pages/vault/GraphPage";
import { NotesPage } from "@/pages/vault/NotesPage";
import { StatsPage } from "@/pages/vault/StatsPage";
import { TimerPage } from "@/pages/vault/TimerPage";

/** The full Noxilith app: providers + routes, shared by all access modes. */
export function VaultRoutes() {
  return (
    <CloudProvider>
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
    </CloudProvider>
  );
}
