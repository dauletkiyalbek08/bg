import { test, expect } from "@playwright/test";
const origin = "http://localhost:3001";
test("anonymous and cross-role requests are denied", async ({ request }) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect(
    (
      await request.post("/api/login", {
        data: { login: "student01", demo: true },
      })
    ).ok(),
  ).toBe(true);
  const s = await (await request.get("/api/state")).json();
  expect(s.users).toHaveLength(1);
  expect(s.users[0].hash).toBeUndefined();
  expect(
    s.attempts.every((a: { owner: string }) => a.owner === "student01"),
  ).toBe(true);
  expect((await request.get("/api/pdf?id=demo-attempt-4")).status()).toBe(403);
  expect(
    (
      await request.post("/api/action", {
        data: {
          action: "organization",
          name: "Illegal",
          limit: 1,
          status: "active",
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/action", {
        data: { action: "user-update", id: "student01", role: "superadmin" },
      })
    ).status(),
  ).toBe(403);
});
test("class teachers cannot read another class or private answers", async ({
  request,
}) => {
  await request.post("/api/login", {
    data: { login: "teacher.9a", demo: true },
  });
  const s = await (await request.get("/api/state")).json();
  expect(
    s.users.filter((u: { role: string }) => u.role === "student"),
  ).toHaveLength(3);
  expect(
    s.attempts.every((a: { owner: string }) =>
      ["student01", "student02", "student03"].includes(a.owner),
    ),
  ).toBe(true);
  expect((await request.get("/api/pdf?id=demo-attempt-4")).status()).toBe(403);
  expect((await request.get("/api/pdf?id=demo-attempt-1")).status()).toBe(200);
});
test("specialist creates accounts; mandatory password change protects all data", async ({
  request,
}) => {
  await request.post("/api/login", {
    data: { login: "prof.demo", demo: true },
  });
  const login = "test." + Date.now();
  const created = await request.post("/api/action", {
    data: {
      action: "user-create",
      name: "Тексеру Оқушысы",
      role: "student",
      login,
      classId: "9a",
    },
  });
  expect(created.ok()).toBe(true);
  const { credentials, user } = await created.json();
  expect(credentials.password.length).toBeGreaterThanOrEqual(16);
  await request.post("/api/logout", { data: {} });
  await request.post("/api/login", { data: credentials });
  expect(
    (
      await request.post("/api/action", {
        data: { action: "survey", answers: {}, complete: true, consent: true },
      })
    ).status(),
  ).toBe(403);
  const data = await (await request.get("/api/state")).json();
  expect(data.user.mustChange).toBe(true);
  expect(data.attempts).toHaveLength(0);
  const password = "A-long-new-passphrase!";
  expect(
    (
      await request.post("/api/action", {
        data: { action: "password", password },
      })
    ).ok(),
  ).toBe(true);
  expect((await request.get("/api/state")).status()).toBe(401);
  await request.post("/api/login", { data: { login, password } });
  expect((await (await request.get("/api/state")).json()).user.id).toBe(
    user.id,
  );
});
test("answers persist, version conflicts and incomplete finish are rejected", async ({
  request,
}) => {
  await request.post("/api/login", {
    data: { login: "student05", demo: true },
  });
  await request.post("/api/action", {
    data: {
      action: "survey",
      answers: { values: "help", private: "Тек маманға арналған сұрақ" },
      complete: true,
      consent: true,
    },
  });
  const started = await (
    await request.post("/api/action", {
      data: { action: "start", assignmentId: "demo-assignment" },
    })
  ).json();
  const s = await (await request.get("/api/state")).json();
  const a = s.attempts.find((a: { id: string }) => a.id === started.attemptId);
  expect(a.questions).toHaveLength(36);
  const payload = {
    action: "answer",
    attemptId: a.id,
    questionId: a.questions[0].id,
    value: 4,
    version: 1,
    elapsed: 6000,
  };
  expect((await request.post("/api/action", { data: payload })).ok()).toBe(
    true,
  );
  expect((await request.post("/api/action", { data: payload })).status()).toBe(
    409,
  );
  expect(
    (
      await request.post("/api/action", {
        data: { action: "finish", attemptId: a.id },
      })
    ).status(),
  ).toBe(400);
  const resumed = await (
    await request.post("/api/action", {
      data: { action: "start", assignmentId: "demo-assignment" },
    })
  ).json();
  expect(resumed.attemptId).toBe(a.id);
  await request.post("/api/logout", { data: {} });
  await request.post("/api/login", {
    data: { login: "teacher.10b", demo: true },
  });
  const teacher = await (await request.get("/api/state")).json();
  expect(JSON.stringify(teacher)).not.toContain("Тек маманға арналған сұрақ");
});
test("staff comments respect visibility and export is a real workbook", async ({
  request,
}) => {
  await request.post("/api/login", {
    data: { login: "prof.demo", demo: true },
  });
  await request.post("/api/action", {
    data: {
      action: "comment",
      owner: "student01",
      text: "Ішкі құпия пікір",
      visibility: "staff",
    },
  });
  const exportFile = await request.get("/api/export");
  expect(exportFile.ok()).toBe(true);
  expect((await exportFile.body()).subarray(0, 2).toString()).toBe("PK");
  await request.post("/api/logout", { data: {} });
  await request.post("/api/login", {
    data: { login: "student01", demo: true },
  });
  expect(
    JSON.stringify(await (await request.get("/api/state")).json()),
  ).not.toContain("Ішкі құпия пікір");
  const pdf = await request.get("/api/pdf?id=demo-attempt-1");
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});
test("CSV preview, validation and idempotent import", async ({ request }) => {
  await request.post("/api/login", {
    data: { login: "prof.demo", demo: true },
  });
  const login = "import." + Date.now();
  const csv = `Аты,Тегі,Сынып,Логин,Рөлі\nСынақ,Импорт,9 «А»,${login},Оқушы\n`;
  const response = await request.post("/api/import-preview", {
    multipart: {
      file: {
        name: "students.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      },
    },
  });
  expect(response.ok()).toBe(true);
  const { rows, key } = await response.json();
  expect(rows[0].errors).toHaveLength(0);
  const imported = await request.post("/api/action", {
    data: {
      action: "import",
      rows: rows.map((r: { name: string; login: string; classId: string }) => ({
        name: r.name,
        login: r.login,
        classId: r.classId,
      })),
      key,
    },
  });
  expect(imported.ok()).toBe(true);
  expect((await imported.json()).credentialsList).toHaveLength(1);
  expect(
    (
      await request.post("/api/action", {
        data: { action: "import", rows, key },
      })
    ).ok(),
  ).toBe(false);
});
test("learner completes the full UI flow and downloads the result", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Оқушы", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Сәлем, Әсем!" }),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.request.post("/api/login", {
    data: { login: "student06", demo: true },
    headers: { Origin: origin },
  });
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Сауалнама", exact: true })
    .click();
  await page
    .getByLabel("01. Сүйікті істерің қандай?")
    .fill("Шағын жобалар мен тәжірибе");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Сақтау және тестке өту" }).click();
  await page.getByRole("button", { name: "Тестті бастау" }).click();
  for (let i = 0; i < 36; i++) {
    await page
      .locator(".answer-option")
      .nth(i % 5)
      .click();
    await expect(page.locator(".save-status")).toHaveText("Сақталды");
    if (i < 35)
      await page.getByRole("button", { name: "Келесі", exact: true }).click();
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Тестті аяқтау", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Сенің мүмкіндіктер картаң" }),
  ).toBeVisible();
  await expect(page.locator(".recommendation")).toHaveCount(5);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDF жүктеу" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Bagdar-result.pdf");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Басты бет", exact: true })
    .click();
  await expect(page.locator(".toast")).toBeHidden({ timeout: 7000 });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Мәзірді ашу" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
});

test("private materials, attendance and feedback use training audience permissions", async ({
  request,
}) => {
  await request.post("/api/login", {
    data: { login: "prof.demo", demo: true },
  });
  const created = await request.post("/api/material", {
    multipart: {
      trainingId: "training-1",
      file: {
        name: "Бағдар.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\nSynthetic test material"),
      },
    },
  });
  expect(created.ok()).toBe(true);
  const state = await (await request.get("/api/state")).json();
  const material = state.materials.find(
    (m: { trainingId: string }) => m.trainingId === "training-1",
  );
  expect(material).toBeTruthy();
  const invalid = await request.post("/api/material", {
    multipart: {
      trainingId: "training-1",
      file: {
        name: "evil.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("<html>not a PDF</html>"),
      },
    },
  });
  expect(invalid.status()).toBe(400);
  await request.post("/api/action", {
    data: {
      action: "attendance",
      id: "training-1",
      owner: "student01",
      value: "present",
    },
  });
  await request.post("/api/logout", { data: {} });
  await request.post("/api/login", {
    data: { login: "student01", demo: true },
  });
  expect((await request.get("/api/material?id=" + material.id)).ok()).toBe(
    true,
  );
  expect(
    (
      await request.post("/api/action", {
        data: {
          action: "feedback",
          trainingId: "training-1",
          rating: 4,
          text: "Жаңа идеялар пайда болды",
        },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post("/api/action", {
        data: {
          action: "feedback",
          trainingId: "training-2",
          rating: 4,
          text: "Too early",
        },
      })
    ).status(),
  ).toBe(400);
  const own = await (await request.get("/api/state")).json();
  expect(
    own.trainings.find((t: { id: string }) => t.id === "training-1").attendance,
  ).toEqual({ student01: "present" });
  expect(own.classes).toHaveLength(1);
});

test("superadmin, other organization, suspended subscription and blocked sessions", async ({
  request,
  playwright,
}) => {
  const { readFile } = await import("node:fs/promises");
  const credentials = JSON.parse(
    await readFile(
      process.env.BAGDAR_E2E_DATA_DIR + "/demo-credentials.json",
      "utf8",
    ),
  );
  const admin = credentials.find(
    (c: { login: string }) => c.login === "superadmin",
  );
  await request.post("/api/login", { data: admin });
  const state = await (await request.get("/api/state")).json();
  expect(state.attempts).toHaveLength(0);
  expect(
    state.users.every((u: { role: string }) => u.role === "specialist"),
  ).toBe(true);
  const newStaff = await (
    await request.post("/api/action", {
      data: {
        action: "user-create",
        name: "Басқа мектеп маманы",
        role: "specialist",
        org: "other-school",
        login: "other.prof." + Date.now(),
      },
    })
  ).json();
  const staffContext = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  await staffContext.post("/api/login", { data: newStaff.credentials });
  await staffContext.post("/api/action", {
    data: { action: "password", password: "Other-school-password-123" },
  });
  await staffContext.post("/api/login", {
    data: {
      login: newStaff.credentials.login,
      password: "Other-school-password-123",
    },
  });
  const other = await (await staffContext.get("/api/state")).json();
  expect(
    other.users.every((u: { org: string }) => u.org === "other-school"),
  ).toBe(true);
  expect((await staffContext.get("/api/pdf?id=demo-attempt-1")).status()).toBe(
    403,
  );
  expect(
    (
      await staffContext.post("/api/action", {
        data: { action: "user-update", id: "student01", blocked: true },
      })
    ).status(),
  ).toBe(403);
  const learner = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  await learner.post("/api/login", {
    data: { login: "student01", demo: true },
  });
  await request.post("/api/action", {
    data: {
      action: "organization",
      id: "demo-school",
      name: "Bagdar демо мектеп",
      city: "Алматы",
      status: "suspended",
      limit: 1000,
    },
  });
  expect((await learner.get("/api/state")).ok()).toBe(true);
  expect(
    (
      await learner.post("/api/action", {
        data: { action: "survey", answers: {}, complete: false },
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/action", {
    data: {
      action: "organization",
      id: "demo-school",
      name: "Bagdar демо мектеп",
      city: "Алматы",
      status: "active",
      limit: 1000,
    },
  });
  const staff = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  await staff.post("/api/login", { data: { login: "prof.demo", demo: true } });
  await staff.post("/api/action", {
    data: { action: "user-update", id: "student01", blocked: true },
  });
  expect((await learner.get("/api/state")).status()).toBe(401);
  await staff.post("/api/action", {
    data: { action: "user-update", id: "student01", blocked: false },
  });
  await staffContext.dispose();
  await learner.dispose();
  await staff.dispose();
});
