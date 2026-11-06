-- Custom SQL migration file, put your code below! --
-- The shop row is required configuration, not demo data: every database needs exactly one.
-- Values decided by the owner on 2026-11-06.
INSERT INTO "shop_settings" ("name", "currency", "default_country")
VALUES ('Hantesi-Mongolia', 'MNT', 'MN');
