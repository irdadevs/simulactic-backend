import type { RouteDef } from ".";
import { LogController } from "../controllers/Log.controller";
import { AuthMiddleware } from "../middlewares/Auth.middleware";
import { ScopeMiddleware } from "../middlewares/Scope.middleware.ts";

export function LogRoutes(
  ctrl: LogController,
  auth: AuthMiddleware,
  _scope: ScopeMiddleware,
): RouteDef[] {
  return [
    {
      method: "post",
      path: "",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.create,
    },
    {
      method: "get",
      path: "",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.list,
    },
    {
      method: "get",
      path: "/:id",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.findById,
    },
    {
      method: "patch",
      path: "/:id/resolve",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.resolve,
    },
    {
      method: "patch",
      path: "/:id/reopen",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.reopen,
    },
    {
      method: "patch",
      path: "/:id/admin-note",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.upsertAdminNote,
    },
    {
      method: "delete",
      path: "/:id/admin-note",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.deleteAdminNote,
    },
  ];
}
