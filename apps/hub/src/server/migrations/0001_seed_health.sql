-- Seed the tracer-bullet health row: the landing page renders this value,
-- proving the full SPA → tRPC → handler → Store → DB path end to end.
INSERT INTO "health" ("value") VALUES ('hello from postgres');
