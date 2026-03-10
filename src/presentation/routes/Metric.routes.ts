import type { RouteDef } from ".";
import { MetricController } from "../controllers/Metric.controller";
import { AuthMiddleware } from "../middlewares/Auth.middleware";
import { ScopeMiddleware } from "../middlewares/Scope.middleware.ts";

export function MetricRoutes(
  ctrl: MetricController,
  auth: AuthMiddleware,
  _scope: ScopeMiddleware,
): RouteDef[] {
  return [
    {
      method: "post",
      path: "/performance",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.track,
    },
    {
      method: "get",
      path: "/performance",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.list,
    },
    {
      method: "get",
      path: "/performance/dashboard",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.dashboard,
    },
    {
      method: "get",
      path: "/performance/traffic",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.traffic,
    },
    {
      method: "get",
      path: "/performance/:id",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.findById,
    },
  ];
}
