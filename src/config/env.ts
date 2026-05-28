import "dotenv/config";

export interface Env {
  port: number;
  databaseUrl: string;
  adminDatabaseUrl: string;
}

export function readEnv(): Env {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgresql://taskiron_app:taskiron_app@localhost:5432/taskiron",
    adminDatabaseUrl:
      process.env.ADMIN_DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/taskiron"
  };
}
