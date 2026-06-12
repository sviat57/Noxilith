import { VaultRoutes } from "@/components/vault/VaultRoutes";

/** Public mode (Vercel / self-hosted): the full app, no Viktor gate. */
export function PublicAppRoutes() {
  return <VaultRoutes />;
}
