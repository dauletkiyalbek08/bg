import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { ensureSeed } from "../lib/seed";
import { isSupabase, transaction, adminClient } from "../lib/store";
import { makeQuestions, makeCareers } from "../lib/content";
nextEnv.loadEnvConfig(process.cwd());
if (!isSupabase()) {
  await ensureSeed();
  console.log(
    "Demo initialized. One-time credentials are stored locally in .data/demo-credentials.json (never commit or share).",
  );
} else {
  await transaction(async (s) => {
    for (const q of makeQuestions())
      if (!(await s.get("questions", q.id))) await s.put("questions", q);
    for (const c of makeCareers())
      if (!(await s.get("careers", c.id))) await s.put("careers", c);
  });
  console.log("Shared content initialized.");
  if (process.argv.includes("--bootstrap")) {
    const login = process.env.BAGDAR_BOOTSTRAP_LOGIN,
      password = process.env.BAGDAR_BOOTSTRAP_PASSWORD;
    if (
      !login ||
      !password ||
      password.length < 16 ||
      !/^[a-z0-9._-]{3,40}$/.test(login)
    )
      throw new Error(
        "Set BAGDAR_BOOTSTRAP_LOGIN and BAGDAR_BOOTSTRAP_PASSWORD (16+ characters) securely.",
      );
    await transaction(async (s) => {
      if ((await s.all("users")).some((u) => u.role === "superadmin"))
        throw new Error("A platform administrator already exists.");
      const { data, error } = await adminClient().auth.admin.createUser({
        email: `${login}@accounts.bagdar.invalid`,
        password,
        email_confirm: true,
      });
      if (error) throw new Error("Auth bootstrap failed.");
      await s.put("users", {
        id: data.user?.id || randomUUID(),
        authId: data.user.id,
        org: null,
        classId: null,
        name: "Платформа әкімшісі",
        login,
        role: "superadmin",
        blocked: false,
        mustChange: true,
      });
    });
    console.log(
      "Administrator created. Remove bootstrap credentials from the environment.",
    );
  }
}
