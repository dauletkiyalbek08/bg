import { test, expect } from "@playwright/test";
test("all three demo entry buttons open the correct dashboard", async ({
  page,
}) => {
  for (const [label, name] of [
    ["Оқушы", "Әсем"],
    ["Сынып жетекшісі", "Әлия"],
    ["Маман", "Айдана"],
  ]) {
    await page.goto("/");
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `Сәлем, ${name}!` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Шығу", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Қош келдің!" }),
    ).toBeVisible();
  }
});
test("demo errors are visible and allow retry on a small screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let calls = 0;
  await page.route("**/api/login", (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          status: 503,
          contentType: "text/html",
          body: "<h1>Gateway Timeout</h1>",
        })
      : route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Оқушы", exact: true }).click();
  await expect(page.locator('.login-form [role="alert"]')).toContainText(
    "Серверден дұрыс жауап",
  );
  await expect(page.locator('.login-form [role="alert"]')).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Оқушы", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Оқушы", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Сәлем, Әсем!" }),
  ).toBeVisible();
});
test("stalled demo login times out and releases the button", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Оқушы", exact: true }),
  ).toBeEnabled();
  await page.clock.install();
  const sent = page.waitForRequest("**/api/login");
  await page.route("**/api/login", () => {});
  await page.getByRole("button", { name: "Оқушы", exact: true }).click();
  await sent;
  await expect(page.getByRole("status")).toHaveText("Кіру тексерілуде…");
  await page.clock.runFor(21000);
  await expect(page.locator('.login-form [role="alert"]')).toContainText(
    "күту уақыты аяқталды",
  );
  await expect(
    page.getByRole("button", { name: "Оқушы", exact: true }),
  ).toBeEnabled();
});
test("browser storage restrictions do not break demo login", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage denied", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Оқушы", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Сәлем, Әсем!" }),
  ).toBeVisible();
});

test("a stalled profile request releases login and explains the failure", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.route("**/api/state", () => {});
  const profile = page.waitForRequest("**/api/state");
  await page.getByRole("button", { name: "Оқушы", exact: true }).click();
  await profile;
  await expect(page.getByRole("status")).toHaveText("Кабинет ашылуда…");
  await page.clock.runFor(11000);
  await expect(page.locator('.login-form [role="alert"]')).toContainText(
    "күту уақыты аяқталды",
  );
  await expect(
    page.getByRole("button", { name: "Оқушы", exact: true }),
  ).toBeEnabled();
});
test("a missing session cookie produces an actionable error instead of a stuck login", async ({
  page,
}) => {
  await page.route("**/api/login", (route) =>
    route.fulfill({ status: 200, json: { ok: true } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Оқушы", exact: true }).click();
  await expect(page.locator('.login-form [role="alert"]')).toContainText(
    "Кіру сеансы расталмады",
  );
  await expect(
    page.getByRole("button", { name: "Оқушы", exact: true }),
  ).toBeEnabled();
});
