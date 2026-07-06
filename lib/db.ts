import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export const sql = postgres(process.env.DATABASE_URL, {
  max: 5,
  prepare: false,
  ssl: "require",
});
