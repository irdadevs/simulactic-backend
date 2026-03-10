import { Asteroid } from "../../domain/aggregates/Asteroid";
import { Donation } from "../../domain/aggregates/Donation";
import { Galaxy } from "../../domain/aggregates/Galaxy";
import { Log } from "../../domain/aggregates/Log";
import { Metric } from "../../domain/aggregates/Metric";
import { Moon } from "../../domain/aggregates/Moon";
import { Planet } from "../../domain/aggregates/Planet";
import { Star } from "../../domain/aggregates/Star";
import { System } from "../../domain/aggregates/System";

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|cookie|hash|credential|api[-_]?key|session)/i;

const maskIdentifier = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const sanitizeUnknown = (value: unknown): unknown => {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeUnknown(inner);
      }
    }
    return result;
  }
  if (typeof value === "string" && value.toLowerCase().startsWith("bearer ")) {
    return "[REDACTED]";
  }
  return value;
};

export const presentGalaxy = (galaxy: Galaxy) => ({
  id: galaxy.id,
  ownerId: galaxy.ownerId,
  name: galaxy.name,
  shape: galaxy.shape,
  systemCount: Number.isFinite(galaxy.systemCount) ? galaxy.systemCount : null,
  createdAt: toIso(galaxy.createdAt),
});

export const presentSystem = (system: System) => ({
  id: system.id,
  galaxyId: system.galaxyId,
  name: system.name,
  position: system.position,
});

export const presentStar = (star: Star) => ({
  id: star.id,
  systemId: star.systemId,
  name: star.name,
  starType: star.starType,
  starClass: star.starClass,
  color: star.color,
  surfaceTemperature: star.surfaceTemperature,
  relativeMass: star.relativeMass,
  relativeRadius: star.relativeRadius,
  isMain: star.isMain,
  orbital: star.orbital,
  orbitalStarter: star.orbitalStarter,
});

export const presentPlanet = (planet: Planet) => ({
  id: planet.id,
  systemId: planet.systemId,
  name: planet.name,
  type: planet.type,
  size: planet.size,
  orbital: planet.orbital,
  biome: planet.biome,
  temperature: planet.temperature,
  relativeMass: planet.relativeMass,
  relativeRadius: planet.relativeRadius,
});

export const presentMoon = (moon: Moon) => ({
  id: moon.id,
  planetId: moon.planetId,
  name: moon.name,
  size: moon.size,
  orbital: moon.orbital,
  temperature: moon.temperature,
  relativeMass: moon.relativeMass,
  relativeRadius: moon.relativeRadius,
});

export const presentAsteroid = (asteroid: Asteroid) => ({
  id: asteroid.id,
  systemId: asteroid.systemId,
  name: asteroid.name,
  type: asteroid.type,
  size: asteroid.size,
  orbital: asteroid.orbital,
});

export const presentDonation = (donation: Donation) => ({
  id: donation.id,
  userId: donation.userId,
  donationType: donation.donationType,
  amountMinor: donation.amountMinor,
  currency: donation.currency,
  status: donation.status,
  currentPeriodStart: toIso(donation.currentPeriodStart),
  currentPeriodEnd: toIso(donation.currentPeriodEnd),
  createdAt: toIso(donation.createdAt),
  updatedAt: toIso(donation.updatedAt),
  canceledAt: toIso(donation.canceledAt),
});

export const presentDonationAdmin = (donation: Donation) => ({
  ...presentDonation(donation),
  provider: donation.provider,
  providerSessionIdMasked: maskIdentifier(donation.providerSessionId),
  providerCustomerIdMasked: maskIdentifier(donation.providerCustomerId),
  providerSubscriptionIdMasked: maskIdentifier(donation.providerSubscriptionId),
});

export const presentMetric = (metric: Metric) => ({
  id: metric.id,
  metricName: metric.metricName,
  metricType: metric.metricType,
  source: metric.source,
  durationMs: metric.durationMs,
  success: metric.success,
  occurredAt: toIso(metric.occurredAt),
});

export const presentMetricAdmin = (metric: Metric) => ({
  ...presentMetric(metric),
  userId: metric.userId,
  requestId: metric.requestId,
  tags: sanitizeUnknown(metric.tags),
  context: sanitizeUnknown(metric.context),
});

export const presentLog = (log: Log) => ({
  id: log.id,
  source: log.source,
  level: log.level,
  category: log.category,
  message: log.message,
  userId: log.userId,
  requestId: log.requestId,
  method: log.method,
  path: log.path,
  statusCode: log.statusCode,
  tags: log.tags,
  occurredAt: toIso(log.occurredAt),
  resolvedAt: toIso(log.resolvedAt),
  resolvedBy: log.resolvedBy,
});

export const presentLogAdmin = (log: Log) => ({
  ...presentLog(log),
  context: log.context,
  ip: log.ip,
  userAgent: log.userAgent,
  fingerprint: log.fingerprint,
  adminNote: log.adminNote,
  adminNoteUpdatedAt: toIso(log.adminNoteUpdatedAt),
  adminNoteUpdatedBy: log.adminNoteUpdatedBy,
});
