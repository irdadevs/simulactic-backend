CREATE SCHEMA IF NOT EXISTS assets;

CREATE TABLE IF NOT EXISTS assets.resource_families (
    id integer PRIMARY KEY,
    name non_empty_text NOT NULL UNIQUE
)

CREATE TABLE
    IF NOT EXISTS assets.resources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name non_empty_text NOT NULL UNIQUE,
        description non_empty_text NOT NULL,
        family_id non_empty_text NOT NULL REFERENCES assets.resource_families(id),
    );

CREATE TABLE IF NOT EXISTS assets.star_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    star_id uuid NOT NULL REFERENCES procedurals.stars(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES assets.resources(id) ON DELETE CASCADE,
    amount pos_int NOT NULL
);

CREATE TABLE IF NOT EXISTS assets.planet_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    planet_id uuid NOT NULL REFERENCES procedurals.planets(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES assets.resources(id) ON DELETE CASCADE,
    amount pos_int NOT NULL
);
CREATE TABLE IF NOT EXISTS assets.moon_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moon_id uuid NOT NULL REFERENCES procedurals.moons(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES assets.resources(id) ON DELETE CASCADE,
    amount pos_int NOT NULL
);
CREATE TABLE IF NOT EXISTS assets.asteroid_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asteroid_id uuid NOT NULL REFERENCES procedurals.asteroids(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES assets.resources(id) ON DELETE CASCADE,
    amount pos_int NOT NULL
);
