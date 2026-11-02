const backend = () =>
  process.env.BAGDAR_BACKEND || process.env.BAGDAR_DEFAULT_BACKEND || "sqlite";
export const isSupabase = () => backend() === "supabase";
export const isNetlify = () => backend() === "netlify";
export const demoEnabled = () =>
  !isSupabase() &&
  ((process.env.BAGDAR_MODE || process.env.BAGDAR_DEFAULT_MODE) === "demo" ||
    process.env.NODE_ENV !== "production");
