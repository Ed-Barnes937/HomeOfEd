// Hand-written tracer-bullet migration (+ seed row so the health value is
// DB-sourced). T2.1 replaces this with a real generate+apply migration runner.
export const migrations: readonly string[] = [
  `create table if not exists health (id serial primary key, value text not null)`,
  `insert into health (value) values ('hello from pglite')`,
]
