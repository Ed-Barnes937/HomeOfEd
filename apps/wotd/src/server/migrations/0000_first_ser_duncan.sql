CREATE TYPE "public"."difficulty_level" AS ENUM('beginner', 'intermediate', 'advanced', 'expert');--> statement-breakpoint
CREATE TABLE "words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" text NOT NULL,
	"definition" text NOT NULL,
	"example_sentence" text NOT NULL,
	"alternatives" text[] NOT NULL,
	"difficulty" "difficulty_level" NOT NULL,
	"for_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "words_for_date_difficulty_unique" UNIQUE("for_date","difficulty")
);
