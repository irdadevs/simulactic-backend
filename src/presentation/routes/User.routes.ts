import type { RouteDef } from ".";
import { UserController } from "../controllers/User.controller";
import { AuthMiddleware } from "../middlewares/Auth.middleware";
import { ScopeMiddleware } from "../middlewares/Scope.middleware.ts";

export function UserRoutes(
  ctrl: UserController,
  auth: AuthMiddleware,
  _scope: ScopeMiddleware,
): RouteDef[] {
  return [
    {
      method: "get",
      path: "/health",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.health,
    },
    {
      method: "post",
      path: "/login",
      handler: ctrl.login,
    },
    {
      method: "post",
      path: "/token/refresh",
      handler: ctrl.refresh,
    },
    {
      method: "post",
      path: "/logout",
      before: [auth.requireAuth()],
      handler: ctrl.logout,
    },
    {
      method: "post",
      path: "/logout/all",
      before: [auth.requireAuth()],
      handler: ctrl.logoutAll,
    },
    {
      method: "post",
      path: "/signup",
      handler: ctrl.signup,
    },
    {
      method: "post",
      path: "/admins",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.createAdmin,
    },
    {
      method: "patch",
      path: "/me/email",
      before: [auth.requireAuth()],
      handler: ctrl.changeEmail,
    },
    {
      method: "get",
      path: "/me",
      before: [auth.requireAuth()],
      handler: ctrl.me,
    },
    {
      method: "get",
      path: "/me/supporter-progress",
      before: [auth.requireAuth()],
      handler: ctrl.mySupporterProgress,
    },
    {
      method: "patch",
      path: "/me/password",
      before: [auth.requireAuth()],
      handler: ctrl.changePassword,
    },
    {
      method: "patch",
      path: "/me/username",
      before: [auth.requireAuth()],
      handler: ctrl.changeUsername,
    },
    {
      method: "post",
      path: "/verify",
      handler: ctrl.verify,
    },
    {
      method: "post",
      path: "/verify/resend",
      handler: ctrl.resendVerification,
    },
    {
      method: "delete",
      path: "/me",
      before: [auth.requireAuth()],
      handler: ctrl.selfSoftDelete,
    },
    {
      method: "get",
      path: "",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.list,
    },
    {
      method: "get",
      path: "/email/:email",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.findUserByEmail,
    },
    {
      method: "get",
      path: "/username/:username",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.findUserByUsername,
    },
    {
      method: "get",
      path: "/bans",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.listActiveBans,
    },
    {
      method: "post",
      path: "/bans/ip",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.banIp,
    },
    {
      method: "post",
      path: "/bans/ip/unban",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.unbanIp,
    },
    {
      method: "get",
      path: "/:id",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.findUserById,
    },
    {
      method: "patch",
      path: "/:id/role",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.changeRole,
    },
    {
      method: "post",
      path: "/:id/ban",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.banUser,
    },
    {
      method: "post",
      path: "/:id/unban",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.unbanUser,
    },
    {
      method: "delete",
      path: "/soft-delete",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.softDelete,
    },
    {
      method: "post",
      path: "/restore",
      before: [auth.requireAuth(), auth.requireRoles("Admin")],
      handler: ctrl.restore,
    },
  ];
}
