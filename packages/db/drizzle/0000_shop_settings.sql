CREATE TABLE "shop_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"currency" char(3) NOT NULL,
	"default_country" char(2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_settings_single_row" CHECK ("shop_settings"."id" = 1),
	CONSTRAINT "shop_settings_name_not_empty" CHECK ("shop_settings"."name" <> ''),
	CONSTRAINT "shop_settings_currency_iso" CHECK ("shop_settings"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "shop_settings_country_iso" CHECK ("shop_settings"."default_country" ~ '^[A-Z]{2}$')
);
