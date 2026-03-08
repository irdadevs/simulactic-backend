import type { RouteDef } from ".";
import { GalaxyController } from "../controllers/Galaxy.controller";
import { AuthMiddleware } from "../middlewares/Auth.middleware";
import { ScopeMiddleware } from "../middlewares/Scope.middleware.ts";

export function GalaxyRoutes(
  ctrl: GalaxyController,
  auth: AuthMiddleware,
  _scope: ScopeMiddleware,
): RouteDef[] {
  return [
    {
      method: "post",
      path: "",
      before: [auth.requireAuth()],
      handler: ctrl.create,
    },
    {
      method: "get",
      path: "",
      before: [auth.requireAuth()],
      handler: ctrl.list,
    },
    {
      method: "get",
      path: "/owner/:ownerId",
      before: [auth.requireAuth()],
      handler: ctrl.findByOwner,
    },
    {
      method: "get",
      path: "/name/:name",
      before: [auth.requireAuth()],
      handler: ctrl.findByName,
    },
    {
      method: "get",
      path: "/counts/global",
      before: [auth.requireAuth()],
      handler: ctrl.globalCounts,
    },
    {
      method: "get",
      path: "/:id/populate",
      before: [auth.requireAuth()],
      handler: ctrl.populate,
    },
    {
      method: "get",
      path: "/:id/counts",
      before: [auth.requireAuth()],
      handler: ctrl.counts,
    },
    {
      method: "get",
      path: "/:id",
      before: [auth.requireAuth()],
      handler: ctrl.findById,
    },
    {
      method: "patch",
      path: "/:id/name",
      before: [auth.requireAuth()],
      handler: ctrl.changeName,
    },
    {
      method: "patch",
      path: "/:id/shape",
      before: [auth.requireAuth()],
      handler: ctrl.changeShape,
    },
    {
      method: "delete",
      path: "/:id",
      before: [auth.requireAuth()],
      handler: ctrl.delete,
    },
  ];
}
