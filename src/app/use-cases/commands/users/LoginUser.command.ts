import { Email, User } from "../../../../domain/aggregates/User";
import { LoginDTO } from "../../../../presentation/security/users/Login.dto";
import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { IHasher } from "../../../interfaces/Hasher.port";
import { IUser } from "../../../interfaces/User.port";

export class LoginUser {
  constructor(
    private readonly repo: IUser,
    private readonly hasher: IHasher,
  ) {}

  async execute(dto: LoginDTO): Promise<User> {
    // Archival is handled by maintenance jobs; login path must stay latency-safe.
    const exist = await this.repo.findByEmail(Email.create(dto.email));

    const passwordHash = exist?.passwordHash ?? "$2b$10$invalidhashforcompare";

    const comparedPass = await this.hasher.compare(dto.rawPassword, passwordHash);

    if (!exist || !comparedPass) {
      throw ErrorFactory.presentation("AUTH.INVALID_CREDENTIALS");
    }

    if (!exist.isVerified) {
      throw ErrorFactory.presentation("USERS.EMAIL_NOT_VERIFIED");
    }

    if (exist.isArchived) {
      exist.unarchive();
      const unarchived = await this.repo.save(exist);
      return unarchived;
    }

    return exist;
  }
}
