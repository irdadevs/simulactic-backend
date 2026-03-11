import { Uuid } from "../../../domain/aggregates/User";
import { ChangeEmailDTO } from "../../../presentation/security/users/ChangeEmail.dto";
import { ChangePasswordDTO } from "../../../presentation/security/users/ChangePassword.dto";
import { ChangeRoleDTO } from "../../../presentation/security/users/ChangeRole.dto";
import { ChangeUsernameDTO } from "../../../presentation/security/users/ChangeUsername.dto";
import { CreateAdminDTO } from "../../../presentation/security/users/CreateAdmin.dto";
import { SignupDTO } from "../../../presentation/security/users/Signup.dto";
import { VerifyDTO } from "../../../presentation/security/users/Verify.dto";
import { ResendVerificationDTO } from "../../../presentation/security/users/ResendVerification.dto";
import { ChangeEmail } from "../../use-cases/commands/users/ChangeEmail.command";
import { ChangePassword } from "../../use-cases/commands/users/ChangePassword.command";
import { ChangeRole } from "../../use-cases/commands/users/ChangeRole.command";
import { ChangeUsername } from "../../use-cases/commands/users/ChangeUsername.command";
import { CreateAdmin } from "../../use-cases/commands/users/CreateAdmin.command";
import { ResendVerificationCode } from "../../use-cases/commands/users/ResendVerificationCode.command";
import { SignupUser } from "../../use-cases/commands/users/SignupUser.command";
import { VerifyUser } from "../../use-cases/commands/users/VerifyUser.command";

export class PlatformService {
  constructor(
    private readonly signupUser: SignupUser,
    private readonly createAdminUser: CreateAdmin,
    private readonly verifyUser: VerifyUser,
    private readonly resendVerificationCode: ResendVerificationCode,
    private readonly changeEmailUser: ChangeEmail,
    private readonly changePasswordUser: ChangePassword,
    private readonly changeRoleUser: ChangeRole,
    private readonly changeUsernameUser: ChangeUsername,
  ) {}

  signup(dto: SignupDTO) {
    return this.signupUser.execute(dto);
  }

  createAdmin(dto: CreateAdminDTO) {
    return this.createAdminUser.execute(dto);
  }

  verify(dto: VerifyDTO) {
    return this.verifyUser.execute(dto);
  }

  resendVerification(dto: ResendVerificationDTO) {
    return this.resendVerificationCode.execute(dto);
  }

  changeEmail(userId: Uuid, dto: ChangeEmailDTO) {
    return this.changeEmailUser.execute(userId, dto);
  }

  changePassword(userId: Uuid, dto: ChangePasswordDTO) {
    return this.changePasswordUser.execute(userId, dto);
  }

  changeRole(userId: Uuid, dto: ChangeRoleDTO) {
    return this.changeRoleUser.execute(userId, dto);
  }

  changeUsername(userId: Uuid, dto: ChangeUsernameDTO) {
    return this.changeUsernameUser.execute(userId, dto);
  }
}
