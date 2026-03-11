import type { RouteDef } from ".";
import { DonationController } from "../controllers/Donation.controller";
import { AuthMiddleware } from "../middlewares/Auth.middleware";
import { ScopeMiddleware } from "../middlewares/Scope.middleware.ts";

export function DonationRoutes(
  ctrl: DonationController,
  auth: AuthMiddleware,
  _scope: ScopeMiddleware,
): RouteDef[] {
  return [
    {
      method: "get",
      path: "/badges",
      before: [auth.requireAuth()],
      handler: ctrl.listBadges,
    },
    {
      method: "post",
      path: "/checkout",
      before: [auth.requireAuth()],
      handler: ctrl.createCheckout,
    },
    {
      method: "post",
      path: "/:id/portal",
      before: [auth.requireAuth()],
      handler: ctrl.createPortalSession,
    },
    {
      method: "post",
      path: "/checkout/:sessionId/confirm",
      before: [auth.requireAuth()],
      handler: ctrl.confirmBySession,
    },
    {
      method: "post",
      path: "/:id/cancel",
      before: [auth.requireAuth()],
      handler: ctrl.cancel,
    },
    {
      method: "get",
      path: "",
      before: [auth.requireAuth()],
      handler: ctrl.list,
    },
    {
      method: "get",
      path: "/:id",
      before: [auth.requireAuth()],
      handler: ctrl.findById,
    },
  ];
}
