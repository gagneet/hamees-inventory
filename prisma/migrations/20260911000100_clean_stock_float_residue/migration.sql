-- Clean floating-point residue left by repeated reserve/release arithmetic on Float columns
-- (e.g. reserved = -1.8e-15). Values are rounded to 0.001 m and reservations clamped at zero.
-- Application code now rounds and clamps on every stock change.

UPDATE "ClothInventory"
SET "reserved" = GREATEST(0, ROUND("reserved"::numeric, 3))::double precision
WHERE "reserved" < 0
   OR "reserved" <> ROUND("reserved"::numeric, 3)::double precision;

UPDATE "ClothInventory"
SET "currentStock" = ROUND("currentStock"::numeric, 3)::double precision
WHERE "currentStock" <> ROUND("currentStock"::numeric, 3)::double precision;

UPDATE "AccessoryInventory"
SET "reserved" = 0
WHERE "reserved" < 0;
