import { createErrorFactory, ErrorDef } from "./Errors.factory";

export const ErrorMap = {
  INVALID_UUID_KEY: {
    code: "DOMAIN.INVALID_UUID_KEY",
    httpCode: 422,
    public: true,
  },
  OUT_OF_RANGE: {
    code: "DOMAIN.OUT_OF_RANGE",
    httpCode: 422,
    public: true,
  },
  INVALID_FIELD: {
    code: "PRESENTATION.INVALID_FIELD",
    httpCode: 422,
    public: true,
  },
  NOT_FOUND: {
    code: "SHARED.NOT_FOUND",
    httpCode: 404,
    public: true,
  },
  DEPENDENCY_NOT_FOUND: {
    code: "SHARED.DEPENDENCY_NOT_FOUND",
    httpCode: 500,
    public: false,
  },
  JOB_ALREADY_SCHEDULED: {
    code: "SCHEDULERS.JOB_ALREADY_SCHEDULED",
    httpCode: 500,
    public: false,
  },
  INVALID_CRON_EXPR: {
    code: "SCHEDULERS.INVALID_CRON_EXPR",
    httpCode: 500,
    public: false,
  },
  DATABASE_CONNECTION: {
    code: "INFRA.DATABASE_CONNECTION",
    httpCode: 500,
    public: false,
  },
  DB_POOL_NOT_AVAILABLE: {
    code: "INFRA.DB_POOL_NOT_AVAILABLE",
    httpCode: 500,
    public: false,
  },
  TRANSACTION_FAILED: {
    code: "INFRA.TRANSACTION_FAILED",
    httpCode: 500,
    public: false,
  },
  ORDER_MAP_EMPTY: {
    code: "USERS.ORDER_MAP_EMPTY",
    httpCode: 400,
    public: true,
  },
  INVALID_SECRET: {
    code: "AUTH.INVALID_SECRET",
    httpCode: 400,
    public: true,
  },
  INVALID_CREDENTIALS: {
    code: "AUTH.INVALID_CREDENTIALS",
    httpCode: 400,
    public: true,
  },
  REFRESH_REUSED: {
    code: "AUTH.REFRESH_REUSED",
    httpCode: 400,
    public: true,
  },
  INVALID_REFRESH: {
    code: "AUTH.INVALID_REFRESH",
    httpCode: 400,
    public: true,
  },
  USER_BANNED: {
    code: "AUTH.USER_BANNED",
    httpCode: 403,
    public: true,
  },
  IP_BANNED: {
    code: "AUTH.IP_BANNED",
    httpCode: 403,
    public: true,
  },
  BAN_ALREADY_ACTIVE: {
    code: "AUTH.BAN_ALREADY_ACTIVE",
    httpCode: 409,
    public: true,
  },
  SESSION_EXPIRED: {
    code: "AUTH.SESSION_EXPIRED",
    httpCode: 400,
    public: true,
  },
  SESSION_INVALID: {
    code: "AUTH.SESSION_INVALID",
    httpCode: 400,
    public: true,
  },
  EMAIL_NOT_VERIFIED: {
    code: "USERS.EMAIL_NOT_VERIFIED",
    httpCode: 403,
    public: true,
  },
  INVALID_VERIFICATION_CODE: {
    code: "USERS.INVALID_VERIFICATION_CODE",
    httpCode: 400,
    public: true,
  },
  VERIFICATION_CODE_EXPIRED: {
    code: "USERS.VERIFICATION_CODE_EXPIRED",
    httpCode: 400,
    public: true,
  },
  EMAIL_EXIST_SIGNUP: {
    code: "USERS.EMAIL_EXIST_SIGNUP",
    httpCode: 400,
    public: true,
  },
  EMAIL_EXIST_CHANGE: {
    code: "USERS.EMAIL_EXIST_CHANGE",
    httpCode: 400,
    public: true,
  },
  USERNAME_EXIST_SIGNUP: {
    code: "USERS.USERNAME_EXIST_SIGNUP",
    httpCode: 400,
    public: true,
  },
  USERNAME_EXIST_CHANGE: {
    code: "USERS.USERNAME_EXIST_CHANGE",
    httpCode: 400,
    public: true,
  },
  SOFT_DELETE_FAILED: {
    code: "USERS.SOFT_DELETE_FAILED",
    httpCode: 400,
    public: true,
  },
  RESTORE_FAILED: {
    code: "USERS.RESTORE_FAILED",
    httpCode: 400,
    public: true,
  },
  INVALID_USER_ID: {
    code: "DOMAIN.INVALID_USER_ID",
    httpCode: 400,
    public: true,
  },
  INVALID_USER_EMAIL: {
    code: "DOMAIN.INVALID_USER_EMAIL",
    httpCode: 400,
    public: true,
  },
  INVALID_USER_PASSWORD: {
    code: "DOMAIN.INVALID_USER_PASSWORD",
    httpCode: 400,
    public: true,
  },
  INVALID_USER_USERNAME: {
    code: "DOMAIN.INVALID_USER_USERNAME",
    httpCode: 400,
    public: true,
  },
  INVALID_USER_ROLE: {
    code: "DOMAIN.INVALID_USER_ROLE",
    httpCode: 400,
    public: true,
  },
  INVALID_GALAXY_NAME: {
    code: "DOMAIN.INVALID_GALAXY_NAME",
    httpCode: 400,
    public: true,
  },
  INVALID_GALAXY_SHAPE: {
    code: "DOMAIN.INVALID_GALAXY_SHAPE",
    httpCode: 400,
    public: true,
  },
  INVALID_SYSTEM_NAME: {
    code: "DOMAIN.INVALID_SYSTEM_NAME",
    httpCode: 400,
    public: true,
  },
  INVALID_SYSTEM_POSITION: {
    code: "DOMAIN.INVALID_SYSTEM_POSITION",
    httpCode: 400,
    public: true,
  },
  INVALID_STAR_TYPE: {
    code: "DOMAIN.INVALID_STAR_TYPE",
    httpCode: 400,
    public: true,
  },
  INVALID_STAR_CLASS: {
    code: "DOMAIN.INVALID_STAR_CLASS",
    httpCode: 400,
    public: true,
  },
  INVALID_STAR_COLOR: {
    code: "DOMAIN.INVALID_STAR_COLOR",
    httpCode: 400,
    public: true,
  },
  INVALID_STAR_VALUE: {
    code: "DOMAIN.INVALID_STAR_VALUE",
    httpCode: 400,
    public: true,
  },
  INVALID_PLANET_NAME: {
    code: "DOMAIN.INVALID_PLANET_NAME",
    httpCode: 400,
    public: true,
  },
  INVALID_PLANET_TYPE: {
    code: "DOMAIN.INVALID_PLANET_TYPE",
    httpCode: 400,
    public: true,
  },
  INVALID_PLANET_SIZE: {
    code: "DOMAIN.INVALID_PLANET_SIZE",
    httpCode: 400,
    public: true,
  },
  INVALID_PLANET_BIOME: {
    code: "DOMAIN.INVALID_PLANET_BIOME",
    httpCode: 400,
    public: true,
  },
  INVALID_PLANET_ORBITAL: {
    code: "DOMAIN.INVALID_PLANET_ORBITAL",
    httpCode: 400,
    public: true,
  },
  INVALID_PLANET_VALUE: {
    code: "DOMAIN.INVALID_PLANET_VALUE",
    httpCode: 400,
    public: true,
  },
  INVALID_ASTEROID_TYPE: {
    code: "DOMAIN.INVALID_ASTEROID_TYPE",
    httpCode: 400,
    public: true,
  },
  INVALID_ASTEROID_NAME: {
    code: "DOMAIN.INVALID_ASTEROID_NAME",
    httpCode: 400,
    public: true,
  },
  INVALID_ASTEROID_SIZE: {
    code: "DOMAIN.INVALID_ASTEROID_SIZE",
    httpCode: 400,
    public: true,
  },
  INVALID_ASTEROID_ORBITAL: {
    code: "DOMAIN.INVALID_ASTEROID_ORBITAL",
    httpCode: 400,
    public: true,
  },
  INVALID_MOON_NAME: {
    code: "DOMAIN.INVALID_MOON_NAME",
    httpCode: 400,
    public: true,
  },
  INVALID_MOON_SIZE: {
    code: "DOMAIN.INVALID_MOON_SIZE",
    httpCode: 400,
    public: true,
  },
  INVALID_MOON_ORBITAL: {
    code: "DOMAIN.INVALID_MOON_ORBITAL",
    httpCode: 400,
    public: true,
  },
  INVALID_MOON_VALUE: {
    code: "DOMAIN.INVALID_MOON_VALUE",
    httpCode: 400,
    public: true,
  },
  GALAXY_NAME_ALREADY_EXIST: {
    code: "GALAXY.NAME_ALREADY_EXIST",
    httpCode: 400,
    public: true,
  },
  INVALID_RESOURCE_NAME: {
    code: "DOMAIN.INVALID_RESOURCE_NAME",
    httpCode: 400,
    public: true,
  },
  INVALID_RESOURCE_DESCRIPTION: {
    code: "DOMAIN.INVALID_RESOURCE_DESCRIPTION",
    httpCode: 400,
    public: true,
  },
} as const satisfies Record<string, ErrorDef>;

export type SharedError = (typeof ErrorMap)[keyof typeof ErrorMap];
export type ErrorCode = SharedError["code"];

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorMap.INVALID_UUID_KEY.code]: 'Invalid UUID for "${uuid}".',
  [ErrorMap.OUT_OF_RANGE.code]:
    'Value for "${field}" is out of range. Expected between ${min} and ${max}.',
  [ErrorMap.INVALID_FIELD.code]: 'Invalid value for "${field}".',
  [ErrorMap.NOT_FOUND.code]: '${sourceType} with id "${id}" was not found.',
  [ErrorMap.DEPENDENCY_NOT_FOUND.code]: "Dependency not found. Dependency: {$dep}.",
  [ErrorMap.JOB_ALREADY_SCHEDULED.code]: "Job already scheduled. Name: {$name}.",
  [ErrorMap.INVALID_CRON_EXPR.code]: "Invalid cron expression. Expr: {$expr}.",
  [ErrorMap.DATABASE_CONNECTION.code]: "Database connection max attempts reached.",
  [ErrorMap.DB_POOL_NOT_AVAILABLE.code]:
    "Database Pool not available for Unit Of Work. Null returned.",
  [ErrorMap.TRANSACTION_FAILED.code]: "Atomic database transaction failed. Cause: \n${cause}",
  [ErrorMap.ORDER_MAP_EMPTY.code]: "Order map must contain at least one entry.",
  [ErrorMap.INVALID_SECRET.code]: "Invalid JWT secret.",
  [ErrorMap.INVALID_CREDENTIALS.code]: "Invalid login credentials.",
  [ErrorMap.INVALID_REFRESH.code]: "Invalid session refresh.",
  [ErrorMap.USER_BANNED.code]: "This user is banned.",
  [ErrorMap.IP_BANNED.code]: "This IP address is banned.",
  [ErrorMap.BAN_ALREADY_ACTIVE.code]: 'An active ban already exists for "${target}" (${id}).',
  [ErrorMap.SESSION_INVALID.code]: "Session is invalid.",
  [ErrorMap.EMAIL_NOT_VERIFIED.code]: "Email is not verified. Complete verification first.",
  [ErrorMap.INVALID_VERIFICATION_CODE.code]: "Invalid verification code.",
  [ErrorMap.VERIFICATION_CODE_EXPIRED.code]: "Verification code expired. Request a new code.",
  [ErrorMap.SESSION_EXPIRED.code]: "Session has expired.",
  [ErrorMap.REFRESH_REUSED.code]: "Session refresh token reused.",
  [ErrorMap.EMAIL_EXIST_SIGNUP.code]: 'Email "${newEmail}" is already registered.',
  [ErrorMap.EMAIL_EXIST_CHANGE.code]: 'Email "${email}" is already in use.',
  [ErrorMap.USERNAME_EXIST_SIGNUP.code]: 'Username "${newUsername}" is already taken.',
  [ErrorMap.USERNAME_EXIST_CHANGE.code]: 'Username "${username}" is already taken.',
  [ErrorMap.SOFT_DELETE_FAILED.code]: 'User "${id}" could not be soft-deleted.',
  [ErrorMap.RESTORE_FAILED.code]: 'User "${id}" could not be restored.',
  [ErrorMap.INVALID_USER_ID.code]: 'Invalid user id "${id}".',
  [ErrorMap.INVALID_USER_EMAIL.code]: 'Invalid email address "${email}".',
  [ErrorMap.INVALID_USER_PASSWORD.code]: "Invalid password value.",
  [ErrorMap.INVALID_USER_USERNAME.code]: 'Invalid username "${username}".',
  [ErrorMap.INVALID_USER_ROLE.code]: 'Invalid user role "${role}".',
  [ErrorMap.INVALID_GALAXY_NAME.code]: 'Invalid galaxy name "${name}".',
  [ErrorMap.INVALID_GALAXY_SHAPE.code]: 'Invalid galaxy shape "${shape}".',
  [ErrorMap.INVALID_SYSTEM_NAME.code]: 'Invalid system name "${name}".',
  [ErrorMap.INVALID_SYSTEM_POSITION.code]: 'Invalid system position "${position}".',
  [ErrorMap.INVALID_STAR_TYPE.code]: 'Invalid star type "${type}".',
  [ErrorMap.INVALID_STAR_CLASS.code]: 'Invalid star class "${class}".',
  [ErrorMap.INVALID_STAR_COLOR.code]: 'Invalid star color "${color}".',
  [ErrorMap.INVALID_STAR_VALUE.code]: 'Invalid value for star field "${field}".',
  [ErrorMap.INVALID_PLANET_NAME.code]: 'Invalid planet name "${name}".',
  [ErrorMap.INVALID_PLANET_TYPE.code]: 'Invalid planet type "${type}".',
  [ErrorMap.INVALID_PLANET_SIZE.code]: 'Invalid planet size "${size}".',
  [ErrorMap.INVALID_PLANET_BIOME.code]: 'Invalid planet biome "${biome}".',
  [ErrorMap.INVALID_PLANET_ORBITAL.code]: 'Invalid planet orbital "${orbital}".',
  [ErrorMap.INVALID_PLANET_VALUE.code]: 'Invalid value for planet field "${field}".',
  [ErrorMap.INVALID_ASTEROID_TYPE.code]: 'Invalid asteroid type "${type}".',
  [ErrorMap.INVALID_ASTEROID_NAME.code]: 'Invalid asteroid name "${name}".',
  [ErrorMap.INVALID_ASTEROID_SIZE.code]: 'Invalid asteroid size "${size}".',
  [ErrorMap.INVALID_ASTEROID_ORBITAL.code]: 'Invalid asteroid orbital "${orbital}".',
  [ErrorMap.INVALID_MOON_NAME.code]: 'Invalid moon name "${name}".',
  [ErrorMap.INVALID_MOON_SIZE.code]: 'Invalid moon size "${size}".',
  [ErrorMap.INVALID_MOON_ORBITAL.code]: 'Invalid moon orbital "${orbital}".',
  [ErrorMap.INVALID_MOON_VALUE.code]: 'Invalid value for moon field "${field}".',
  [ErrorMap.GALAXY_NAME_ALREADY_EXIST.code]: 'Galaxy name "${name}" is already in use.',
  [ErrorMap.INVALID_RESOURCE_NAME.code]: 'Invalid resource name "${name}".',
  [ErrorMap.INVALID_RESOURCE_DESCRIPTION.code]: "Invalid resource description.",
};

export const ErrorFactory = createErrorFactory(ErrorMap, ErrorMessages);
