import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error("Для Bagdar установите Node.js 24 LTS: https://nodejs.org/");
  process.exit(1);
}
const args = process.argv.slice(2);
let port = 3000;
let open = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--open") open = true;
  else if (args[i] === "--port" && /^\d+$/.test(args[i + 1] || ""))
    port = Number(args[++i]);
  else {
    console.error("Параметры: --open или --port 3002");
    process.exit(1);
  }
}
if (port < 1024 || port > 65535) {
  console.error("Выберите порт от 1024 до 65535.");
  process.exit(1);
}
const env = {
  ...process.env,
  BAGDAR_BACKEND: "sqlite",
  BAGDAR_MODE: "demo",
  BAGDAR_APP_ORIGIN: "",
  NETLIFY: "false",
  NEXT_TELEMETRY_DISABLED: "1",
};
if (!existsSync(join(root, "node_modules", "next", "package.json"))) {
  const npm = process.env.npm_execpath;
  if (!npm) {
    console.error(
      "Запустите через npm run local, чтобы установить зависимости.",
    );
    process.exit(1);
  }
  console.log(
    "Первый запуск: устанавливаем зависимости. Нужен доступ в интернет.",
  );
  const install = spawn(process.execPath, [npm, "ci", "--no-audit"], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    install.once("error", reject);
    install.once("exit", (code) => resolve(code));
  });
  if (code !== 0) {
    console.error(
      "Установка не завершилась. Проверьте интернет и повторите запуск.",
    );
    process.exit(1);
  }
}
const url = `http://localhost:${port}`;
console.log(
  `\nBagdar — локальная демоверсия\nАдрес в браузере: ${url}\nДля входа выберите «Демо кіру».\nДля остановки: Ctrl+C. Сохранённые данные останутся в .data.\n`,
);
const server = spawn(
  process.execPath,
  [
    join(root, "node_modules", "next", "dist", "bin", "next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { cwd: root, env, stdio: "inherit" },
);
let poll;
let checking = false;
if (open) {
  const deadline = Date.now() + 120000;
  poll = setInterval(async () => {
    if (checking) return;
    if (Date.now() > deadline) {
      clearInterval(poll);
      return;
    }
    checking = true;
    try {
      const response = await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok && (await response.text()).includes("Bagdar")) {
        clearInterval(poll);
        const command =
          process.platform === "win32"
            ? "explorer.exe"
            : process.platform === "darwin"
              ? "open"
              : "xdg-open";
        const browser = spawn(command, [url], {
          detached: true,
          stdio: "ignore",
        });
        browser.on("error", () =>
          console.log(`Откройте браузер самостоятельно: ${url}`),
        );
        browser.unref();
      }
    } catch {
      /* Server may still be starting. */
    } finally {
      checking = false;
    }
  }, 750);
}
const forward = (signal) => server.kill(signal);
const interrupt = () => forward("SIGINT");
const terminate = () => forward("SIGTERM");
process.once("SIGINT", interrupt);
process.once("SIGTERM", terminate);
server.once("error", (error) => {
  clearInterval(poll);
  console.error("Не удалось запустить Bagdar:", error.message);
  process.exitCode = 1;
});
server.once("exit", (code, signal) => {
  clearInterval(poll);
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", terminate);
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
