import { lazy, Suspense } from "react";
import { getViktorSpaceAccessMode } from "@/lib/viktor-spaces-access/config";

const PublicAppRoutes = lazy(() =>
  import("./public/PublicAppRoutes").then(module => ({
    default: module.PublicAppRoutes,
  })),
);
const ViktorAuthAppRoutes = lazy(() =>
  import("./viktor-auth/ViktorAuthAppRoutes").then(module => ({
    default: module.ViktorAuthAppRoutes,
  })),
);

function AuthStrategyLoading() {
  return null;
}

export function AuthStrategyRoutes() {
  const mode = getViktorSpaceAccessMode();

  const routes =
    mode === "viktor_auth" ? <ViktorAuthAppRoutes /> : <PublicAppRoutes />;

  return <Suspense fallback={<AuthStrategyLoading />}>{routes}</Suspense>;
}
