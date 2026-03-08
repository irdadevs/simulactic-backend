import Express from "express";
import request from "supertest";
import { AuthMiddleware } from "../../presentation/middlewares/Auth.middleware";
import { IJWT, JwtClaims } from "../../app/interfaces/Jwt.port";
import { IDS } from "../helpers/apiTestApp";

class TestJwt implements IJWT {
  signAccessToken(): string {
    return "";
  }

  signRefreshToken(): string {
    return "";
  }

  verifyAccessToken(token: string): JwtClaims {
    const [sub, userRole] = token.split("|");
    if (!sub || !userRole) throw new Error("invalid");
    return { sub, userRole, kind: "access" };
  }

  verifyRefreshToken(): JwtClaims {
    throw new Error("not implemented");
  }
}

describe("Integration - AuthMiddleware", () => {
  test("blocks unauthorized and accepts valid auth context", async () => {
    const app = Express();
    const auth = new AuthMiddleware(new TestJwt(), {});

    app.get("/private", auth.requireAuth(), (req, res) => {
      return res.status(200).json({
        userId: req.auth.userId,
        role: req.auth.userRole,
      });
    });

    await request(app).get("/private").expect(401);

    const response = await request(app)
      .get("/private")
      .set("Authorization", `Bearer ${IDS.userA}|User`)
      .expect(200);

    expect(response.body.userId).toBe(IDS.userA);
    expect(response.body.role).toBe("User");
  });

  test("enforces role checks with requireRoles", async () => {
    const app = Express();
    const auth = new AuthMiddleware(new TestJwt(), {});

    app.get("/admin", auth.requireAuth(), auth.requireRoles("Admin"), (_req, res) =>
      res.status(200).json({ ok: true }),
    );

    await request(app).get("/admin").set("Authorization", `Bearer ${IDS.userA}|User`).expect(403);

    await request(app).get("/admin").set("Authorization", `Bearer ${IDS.admin}|Admin`).expect(200);
  });

  test("accepts valid access token from cookie when Authorization header is missing", async () => {
    const app = Express();
    const auth = new AuthMiddleware(new TestJwt(), {});

    app.get("/private", auth.requireAuth(), (req, res) => {
      return res.status(200).json({
        userId: req.auth.userId,
        role: req.auth.userRole,
      });
    });

    const response = await request(app)
      .get("/private")
      .set("Cookie", [`access_token=${IDS.userA}|User`])
      .expect(200);

    expect(response.body.userId).toBe(IDS.userA);
    expect(response.body.role).toBe("User");
  });

  test("returns UNAUTHORIZED for malformed bearer header without token", async () => {
    const app = Express();
    const auth = new AuthMiddleware(new TestJwt(), {});

    app.get("/private", auth.requireAuth(), (_req, res) => {
      return res.status(200).json({ ok: true });
    });

    await request(app).get("/private").set("Authorization", "Bearer").expect(401).expect({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  test("returns INVALID_TOKEN when JWT claims contain invalid uuid", async () => {
    class InvalidUuidJwt extends TestJwt {
      verifyAccessToken(): JwtClaims {
        return { sub: "not-a-uuid", userRole: "User", kind: "access" };
      }
    }

    const app = Express();
    const auth = new AuthMiddleware(new InvalidUuidJwt(), {});
    app.get("/private", auth.requireAuth(), (_req, res) => {
      return res.status(200).json({ ok: true });
    });

    await request(app).get("/private").set("Authorization", "Bearer whatever").expect(401).expect({
      ok: false,
      error: "INVALID_TOKEN",
    });
  });

  test("returns AUTH.USER_BANNED when user is suspended", async () => {
    const app = Express();
    const securityBan = {
      isUserBanned: jest.fn(async (): Promise<boolean> => true),
    } as any;
    const auth = new AuthMiddleware(new TestJwt(), {}, securityBan);

    app.get("/private", auth.requireAuth(), (_req, res) => {
      return res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .get("/private")
      .set("Authorization", `Bearer ${IDS.userA}|User`)
      .expect(403);

    expect(response.body).toEqual({
      ok: false,
      error: "AUTH.USER_BANNED",
      message: "The current user is suspended.",
    });
    expect(securityBan.isUserBanned).toHaveBeenCalledWith(IDS.userA);
  });
});
