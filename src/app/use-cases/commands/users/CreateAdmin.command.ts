import { IUser } from "../../../interfaces/User.port";
import { IHasher } from "../../../interfaces/Hasher.port";
import { CreateAdminDTO } from "../../../../presentation/security/users/CreateAdmin.dto";
import { Email, User, Username } from "../../../../domain/aggregates/User";
import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { UserCacheService } from "../../../app-services/users/UserCache.service";

export class CreateAdmin {
  constructor(
    private readonly userRepo: IUser,
    private readonly hasher: IHasher,
    private readonly userCache: UserCacheService,
  ) {}

  async execute(dto: CreateAdminDTO) {
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
      role: "Admin",
      isVerified: true,
      verifiedAt: new Date(),
    });

    await this.userRepo.save(user);
    await this.userCache.setUser(user);
    await this.userCache.invalidateList();

    return user;
  }
}
