-- Global bootstrap: extension, schemas, domains, enum types
-- Enable UUIDs with pgcrypto (preferred over uuid-ossp)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schemas (some will also be created IF NOT EXISTS later)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS procedurals;
CREATE SCHEMA IF NOT EXISTS metrics;
CREATE SCHEMA IF NOT EXISTS logs;

-- === Domains (reusable checks) ===
CREATE DOMAIN email_addr AS text
  CHECK (VALUE ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$');

CREATE DOMAIN non_empty_text AS text
  CHECK (length(btrim(VALUE)) > 0);

CREATE DOMAIN pos_int AS integer CHECK (VALUE > 0);
CREATE DOMAIN nonneg_int AS integer CHECK (VALUE >= 0);
CREATE DOMAIN nonneg_num AS numeric CHECK (VALUE >= 0);

CREATE DOMAIN min_system_count AS integer CHECK (VALUE >= 1);
CREATE DOMAIN max_system_count AS integer CHECK (VALUE <= 1000);

-- === Types ===
-- Type for guild role *keys* (table will be auth.roles)
CREATE TYPE auth.role_types AS ENUM (
  'User',
  'Admin'
);

-- User session state enums (used by auth.sessions)
CREATE TYPE auth.session_status AS ENUM ('open', 'close', 'timeout');

-- Celestial body sizes
CREATE TYPE procedurals.planet_types AS ENUM ('solid', 'gas');
CREATE TYPE procedurals.planet_sizes AS ENUM ('proto', 'dwarf', 'medium', 'giant', 'supergiant');
CREATE TYPE procedurals.moon_sizes AS ENUM ('dwarf', 'medium', 'giant');
CREATE TYPE procedurals.asteroid_sizes AS ENUM ('small', 'medium', 'big', 'massive');
CREATE TYPE procedurals.asteroid_types AS ENUM ('single', 'cluster');
CREATE TYPE procedurals.star_types AS ENUM (
  'Blue supergiant',
  'Blue giant',
  'White dwarf',
  'Brown dwarf',
  'Yellow dwarf',
  'Subdwarf',
  'Red dwarf',
  'Black hole',
  'Neutron star'
);
CREATE TYPE procedurals.star_classes AS ENUM (
  'O',
  'B',
  'A',
  'F',
  'G',
  'K',
  'M',
  'BH',
  'N'
);
CREATE TYPE procedurals.planet_biomes AS ENUM (
  'ice',
  'tundra',
  'glacial',
  'snow',
  'permafrost',
  'frozen_ocean',
  'ice_canyon',
  'cryo_volcanic',
  'polar_desert',
  'frost_crystal',
  'gaia',
  'temperate',
  'continental',
  'desert',
  'ocean',
  'archipelago',
  'forest',
  'jungle',
  'savanna',
  'wetlands',
  'meadow',
  'arid',
  'dune',
  'volcanic',
  'lava',
  'toxic',
  'radioactive',
  'sulfuric',
  'crystal',
  'barren',
  'none'
);
CREATE TYPE procedurals.galaxy_shapes AS ENUM (
  'spherical',
  '3-arm spiral',
  '5-arm spiral',
  'irregular'
);
