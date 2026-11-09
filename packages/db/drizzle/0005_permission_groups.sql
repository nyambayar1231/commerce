CREATE TYPE "public"."permission" AS ENUM('MANAGE_PRODUCTS', 'MANAGE_ORDERS', 'MANAGE_CHECKOUTS', 'MANAGE_USERS', 'MANAGE_STAFF', 'MANAGE_SETTINGS', 'MANAGE_SHIPPING');--> statement-breakpoint
CREATE TABLE "permission_group" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "permission_group_name_unique" UNIQUE("name"),
	CONSTRAINT "permission_group_name_not_empty" CHECK ("permission_group"."name" <> '')
);
--> statement-breakpoint
CREATE TABLE "permission_group_permission" (
	"group_id" uuid NOT NULL,
	"code" "permission" NOT NULL,
	CONSTRAINT "permission_group_permission_group_id_code_pk" PRIMARY KEY("group_id","code")
);
--> statement-breakpoint
CREATE TABLE "user_permission_group" (
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "user_permission_group_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "permission_group_permission" ADD CONSTRAINT "permission_group_permission_group_id_permission_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."permission_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_group" ADD CONSTRAINT "user_permission_group_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_group" ADD CONSTRAINT "user_permission_group_group_id_permission_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."permission_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_permission_group_group_id_idx" ON "user_permission_group" USING btree ("group_id");