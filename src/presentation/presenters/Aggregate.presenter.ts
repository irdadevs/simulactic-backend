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

export const presentMetric = (metric: Metric) => ({
  id: metric.id,
  metricName: metric.metricName,
  metricType: metric.metricType,
  source: metric.source,
  durationMs: metric.durationMs,
  success: metric.success,
  occurredAt: toIso(metric.occurredAt),
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
