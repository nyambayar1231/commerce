CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"is_staff" boolean DEFAULT false NOT NULL,
	"is_superuser" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_email_not_empty" CHECK ("user"."email" <> ''),
	CONSTRAINT "user_superuser_is_staff" CHECK (NOT "user"."is_superuser" OR "user"."is_staff")
);
