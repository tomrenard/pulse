CREATE TABLE "log" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"detail" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "log_kind_at" ON "log" USING btree ("kind","at");