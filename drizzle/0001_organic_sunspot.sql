CREATE TABLE "coros_auth" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "night" (
	"date" text PRIMARY KEY NOT NULL,
	"hrv" real,
	"hrv_low" real,
	"hrv_high" real,
	"coros_base" real,
	"coros_low" real,
	"coros_high" real,
	"sleep_score" real,
	"asleep_secs" integer,
	"deep_pct" real,
	"light_pct" real,
	"rem_pct" real,
	"awake_min" integer,
	"sleep_start" text,
	"sleep_end" text,
	"rhr" integer,
	"stress" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
