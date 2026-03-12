export const REGEXP = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
  galaxyName: /^[\p{L}\p{N}-]{5,15}$/u,
  systemName: /^[\p{L}\p{N}-]{3,25}$/u,
  planetName: /^[\p{L}\p{N}-]{3,25}$/u,
  moonName: /^[\p{L}\p{N}-]{3,25}$/u,
  asteroidName: /^[\p{L}\p{N}-]{3,25}$/u,
  username: /^[\p{L}\p{N}_-]{3,25}$/u,
  resourceName: /^[\p{L}\p{N}-]{2,15}$/u,
  resourceDescription: /^[\p{L}\p{N}-]{10,255}$/u,
};
