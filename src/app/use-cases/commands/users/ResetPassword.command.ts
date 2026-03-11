import { Email } from "../../../../domain/aggregates/User";
import { ResetPasswordDTO } from "../../../../presentation/security/users/ResetPassword.dto";
import { IHasher } from "../../../interfaces/Hasher.port";
import { IMailer } from "../../../interfaces/Mailer.port";
import { ISession } from "../../../interfaces/Session.port";
import { IUser } from "../../../interfaces/User.port";
import { UserCacheService } from "../../../app-services/users/UserCache.service";

export class ResetPassword {
  private static readonly PASSWORD_CODE_LENGTH = 8;
  private static readonly PASSWORD_CODE_SUBJECT = "Galactic API - Password reset";

  constructor(
    private readonly userRepo: IUser,
    private readonly hasher: IHasher,
    private readonly mailer: IMailer,
    private readonly sessionRepo: ISession,
    private readonly userCache: UserCacheService,
  ) {}

  async execute(dto: ResetPasswordDTO): Promise<void> {
    const email = Email.create(dto.email);
    const user = await this.userRepo.findByEmail(email);

    // Prevent user enumeration.
    if (!user) {
      return;
    }

    const previousPasswordHash = user.passwordHash;
    const passwordCode = this.mailer.genCode(ResetPassword.PASSWORD_CODE_LENGTH);
    const nextPasswordHash = await this.hasher.hash(passwordCode);
    user.changePasswordHash(nextPasswordHash);

    await this.userRepo.save(user);
    await this.userCache.invalidateForMutation(user);
    await this.sessionRepo.revokeAllForUser(user.id);

    try {
      await this.mailer.send(
        email,
        ResetPassword.PASSWORD_CODE_SUBJECT,
        passwordCode,
      );
    } catch (error) {
      user.changePasswordHash(previousPasswordHash);
      await this.userRepo.save(user);
      await this.userCache.invalidateForMutation(user);
      throw error;
    }
  }
}
