import { IUser } from "../../../interfaces/User.port";
import { IHasher } from "../../../interfaces/Hasher.port";
import { SignupDTO } from "../../../../presentation/security/users/Signup.dto";
import { Email, User, Username } from "../../../../domain/aggregates/User";
import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { IMailer } from "../../../interfaces/Mailer.port";
import { UserCacheService } from "../../../app-services/users/UserCache.service";

export class SignupUser {
  private static readonly VERIFICATION_CODE_TTL_MS = 30 * 60 * 1000;

  constructor(
    private readonly userRepo: IUser,
    private readonly hasher: IHasher,
    private readonly mailer: IMailer,
    private readonly userCache: UserCacheService,
  ) {}

  async execute(dto: SignupDTO) {
    const existingByEmail = await this.userRepo.findByEmail(Email.create(dto.email));
    if (existingByEmail) {
      throw ErrorFactory.presentation("USERS.EMAIL_EXIST_SIGNUP", {
        email: dto.email,
      });
    }

    const existingByUsername = await this.userRepo.findByUsername(Username.create(dto.username));
    if (existingByUsername) {
      throw ErrorFactory.presentation("USERS.USERNAME_EXIST_SIGNUP", {
        username: dto.username,
      });
    }

    const passwordHash = await this.hasher.hash(dto.rawPassword);

    const user = User.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      role: "User",
      isVerified: false,
    });
    const code = this.mailer.genCode(8);
    const verificationCodeHash = await this.hasher.hash(code);
    user.setVerificationCode(
      verificationCodeHash,
      new Date(Date.now() + SignupUser.VERIFICATION_CODE_TTL_MS),
    );

    await this.userRepo.save(user);
    await this.userCache.setUser(user);
    await this.userCache.invalidateList();

    try {
      await this.mailer.send(Email.create(dto.email), "Simulactic - Verification code", code);
    } catch (_error) {
      // Keep signup path available even if SMTP is unavailable.
    }

    return user;
  }
}
