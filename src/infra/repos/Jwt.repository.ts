import jwt, { Algorithm, SignOptions, VerifyOptions } from "jsonwebtoken";
import { ErrorFactory } from "../../utils/errors/Error.map";
import { IJWT, JwtClaims } from "../../app/interfaces/Jwt.port";
import { TOKEN_TIMES_MAP } from "../../utils/TokenTimes.map";

const ALG: Algorithm = "HS256";

export default class JwtService implements IJWT {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor() {
    this.accessSecret = this.mustGetEnv("JWT_SECRET");
    this.refreshSecret = this.mustGetEnv("JWT_REFRESH_SECRET");
    this.issuer = this.mustGetEnv("JWT_ISSUER");
    this.audience = this.mustGetEnv("JWT_AUDIENCE");
  }

  private mustGetEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw ErrorFactory.presentation("AUTH.INVALID_SECRET", {
        key,
      });
    }
    return value;
  }

  private baseSignOptions(expiresIn: number): SignOptions {
    return {
      algorithm: ALG,
      expiresIn,
      issuer: this.issuer,
      audience: this.audience,
    };
  }

  private baseVerifyOptions(): VerifyOptions {
    return {
      algorithms: [ALG],
      issuer: this.issuer,
      audience: this.audience,
    };
  }

  signAccessToken(claims: Omit<JwtClaims, "iat" | "exp">): string {
    return jwt.sign(
      claims,
      this.accessSecret,
      this.baseSignOptions(TOKEN_TIMES_MAP.twelveHours),
    );
  }

  signRefreshToken(claims: Omit<JwtClaims, "iat" | "exp">): string {
    return jwt.sign(
      claims,
      this.refreshSecret,
      this.baseSignOptions(TOKEN_TIMES_MAP.oneWeek),
    );
  }

  verifyAccessToken(token: string): JwtClaims {
    return jwt.verify(
      token,
      this.accessSecret,
      this.baseVerifyOptions(),
    ) as JwtClaims;
  }

  verifyRefreshToken(token: string): JwtClaims {
    return jwt.verify(
      token,
      this.refreshSecret,
      this.baseVerifyOptions(),
    ) as JwtClaims;
  }
}
