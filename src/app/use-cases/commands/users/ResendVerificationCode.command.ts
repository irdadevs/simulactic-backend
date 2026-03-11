import { Email } from "../../../../domain/aggregates/User";
import { ResendVerificationDTO } from "../../../../presentation/security/users/ResendVerification.dto";
import { IHasher } from "../../../interfaces/Hasher.port";
import { IMailer } from "../../../interfaces/Mailer.port";
import { IUser } from "../../../interfaces/User.port";
import { UserCacheService } from "../../../app-services/users/UserCache.service";

export class ResendVerificationCode {
  private static readonly VERIFICATION_CODE_TTL_MS = 30 * 60 * 1000;

  constructor(
    private readonly userRepo: IUser,
    private readonly hasher: IHasher,
    private readonly mailer: IMailer,
    private readonly userCache: UserCacheService,
  ) {}

  async execute(dto: ResendVerificationDTO): Promise<void> {
    const email = Email.create(dto.email);
    const user = await this.userRepo.findByEmail(email);

    // Prevent user enumeration.
    if (!user || user.isVerified) {
      return;
    }

    const code = this.mailer.genCode(8);
    const verificationCodeHash = await this.hasher.hash(code);
    user.setVerificationCode(
      verificationCodeHash,
      new Date(Date.now() + ResendVerificationCode.VERIFICATION_CODE_TTL_MS),
    );
    await this.userRepo.save(user);
    await this.userCache.invalidateForMutation(user);

    await this.mailer.send(
      email,
      "Simulactic - Verification code",
      code,
    );
  }
}
