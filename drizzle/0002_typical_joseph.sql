CREATE TABLE "tag" (
	"date" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "tag_date_kind_pk" PRIMARY KEY("date","kind")
);
