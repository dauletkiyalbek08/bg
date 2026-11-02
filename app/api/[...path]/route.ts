import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { transaction, demoEnabled, isSupabase, isNetlify } from "@/lib/store";
import { isTrustedOrigin } from "@/lib/origin";
import { ensureSeed } from "@/lib/seed";
import {
  currentUser,
  createSession,
  verifyPassword,
  tokenHash,
} from "@/lib/auth";
import {
  getState,
  perform,
  HttpError,
  studentAccess,
  writable,
} from "@/lib/service";
import { materialStore } from "@/lib/netlify-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const rates = new Map<string, { count: number; reset: number }>();
function rate(key: string, max: number) {
  const now = Date.now();
  for (const [k, v] of rates) if (v.reset < now) rates.delete(k);
  const v = rates.get(key) || { count: 0, reset: now + 60000 };
  if (++v.count > max)
    throw new HttpError("Сұраулар тым көп. Бір минуттан кейін көріңіз", 429);
  rates.set(key, v);
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
async function handler(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname.slice(5);
    if (req.method === "POST") {
      if (
        !isTrustedOrigin(
          req.headers.get("origin"),
          req.headers.get("host"),
          process.env.BAGDAR_APP_ORIGIN,
          process.env.NODE_ENV !== "production",
        )
      )
        throw new HttpError("Сұрау көзіне рұқсат жоқ", 403);
      if (
        Number(req.headers.get("content-length") || 0) >
        (path === "material" ? 21 : 6) * 1024 * 1024
      )
        throw new HttpError("Файл тым үлкен", 413);
    }
    if (path !== "login" && !req.cookies.has("bagdar_session"))
      throw new HttpError("Жүйеге кіріңіз", 401);
    await ensureSeed();
    if (path === "login" && req.method === "POST") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
      rate("login:" + ip, demoEnabled() ? 120 : 12);
      const b = await req.json();
      const login = z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9._-]{3,40}$/)
        .parse(b.login);
      const token = await transaction(async (s) => {
        const user = (await s.all("users")).find((u) => u.login === login);
        const demo =
          demoEnabled() &&
          b.demo === true &&
          [
            "prof.demo",
            "teacher.9a",
            "teacher.10b",
            "student01",
            "student05",
            "student06",
          ].includes(login);
        let valid = demo;
        if (!demo) {
          const password = z.string().min(1).max(128).parse(b.password);
          if (isSupabase()) {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
              key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
            const client = createClient(url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { error } = await client.auth.signInWithPassword({
              email: `${login}@accounts.bagdar.invalid`,
              password,
            });
            valid = !error;
          } else valid = !!user?.hash && verifyPassword(password, user.hash);
        }
        if (!user || !valid || user.blocked)
          throw new HttpError("Логин немесе құпиясөз қате", 401);
        if (
          user.org &&
          (await s.get("organizations", user.org))?.status === "archived"
        )
          throw new HttpError("Аккаунтқа кіру тоқтатылған", 403);
        return createSession(s, user.id);
      });
      const res = json({ ok: true });
      res.cookies.set("bagdar_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 604800,
      });
      return res;
    }
    return await transaction(async (s) => {
      const u = await currentUser(s);
      if (!u) throw new HttpError("Жүйеге кіріңіз", 401);
      if (path === "logout" && req.method === "POST") {
        const token = (await cookies()).get("bagdar_session")?.value;
        if (token) await s.delete("sessions", tokenHash(token));
        const res = json({ ok: true });
        res.cookies.delete("bagdar_session");
        return res;
      }
      if (u.mustChange && path !== "state" && path !== "action")
        throw new HttpError("Құпиясөзді өзгертіңіз", 403);
      if (path === "state" && req.method === "GET")
        return json(await getState(s, u));
      if (path === "action" && req.method === "POST") {
        rate("action:" + u.id, 180);
        const body = await req.json();
        if (u.mustChange && body.action !== "password")
          throw new HttpError("Алдымен құпиясөзді өзгертіңіз", 403);
        if (body.action === "import" && isSupabase())
          throw new HttpError(
            "Supabase үшін пакеттік импорт әзірге қосылмаған. Аккаунттарды жеке қосыңыз",
            501,
          );
        return json(await perform(s, u, body));
      }
      if (path === "material" && req.method === "POST") {
        if (u.role !== "specialist") throw new HttpError("Рұқсат жоқ", 403);
        await writable(s, u);
        const form = await req.formData(),
          file = form.get("file");
        const training = await s.get(
          "trainings",
          String(form.get("trainingId") || ""),
        );
        if (!training || training.org !== u.org)
          throw new HttpError("Тренинг табылмады", 404);
        if (
          !(file instanceof File) ||
          file.size > 20 * 1024 * 1024 ||
          !file.size
        )
          throw new HttpError("Файл көлемі 20 МБ аспауы керек");
        if (
          (await s.all("materials")).filter((m) => m.trainingId === training.id)
            .length >= 10
        )
          throw new HttpError("Бір тренингке 10 файлға дейін");
        const bytes = Buffer.from(await file.arrayBuffer());
        let mime = "";
        const filename = file.name
          .replace(/[\r\n\x00-\x1F]/g, "")
          .slice(0, 180);
        if (
          /\.pdf$/i.test(filename) &&
          bytes.subarray(0, 5).toString() === "%PDF-"
        )
          mime = "application/pdf";
        else if (
          /\.png$/i.test(filename) &&
          bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          mime = "image/png";
        else if (
          /\.jpe?g$/i.test(filename) &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[2] === 255
        )
          mime = "image/jpeg";
        else if (
          /\.webp$/i.test(filename) &&
          bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP"
        )
          mime = "image/webp";
        if (!mime)
          throw new HttpError(
            "Тек PDF, PNG, JPEG немесе WebP файлдары қолжетімді",
          );
        const id = randomUUID(),
          key = `${u.org}/${training.id}/${id}`;
        if (isSupabase()) {
          const { error } = await (
            await import("@/lib/store")
          )
            .adminClient()
            .storage.from("bagdar-materials")
            .upload(key, bytes, { contentType: mime, upsert: false });
          if (error) throw new HttpError("Файл жүктелмеді");
        } else if (isNetlify()) {
          await materialStore().set(
            id,
            new Blob([new Uint8Array(bytes)], { type: mime }),
          );
          s.onRollback(() => materialStore().delete(id));
        } else {
          const dir = join(
            process.env.BAGDAR_DATA_DIR || join(process.cwd(), ".data"),
            "materials",
          );
          await mkdir(dir, { recursive: true, mode: 0o700 });
          await writeFile(join(dir, id), bytes, { mode: 0o600 });
        }
        await s.put("materials", {
          id,
          org: u.org!,
          trainingId: training.id,
          filename,
          mime,
          size: file.size,
          key,
        });
        await s.put("trainings", training);
        return json({ ok: true });
      }
      if (path === "material" && req.method === "GET") {
        const state = await getState(s, u);
        const material = state.materials.find(
          (m) => m.id === req.nextUrl.searchParams.get("id"),
        );
        if (!material) throw new HttpError("Материал табылмады", 404);
        if (isSupabase()) {
          const { data, error } = await (
            await import("@/lib/store")
          )
            .adminClient()
            .storage.from("bagdar-materials")
            .createSignedUrl(material.key, 60, { download: material.filename });
          if (error) throw new HttpError("Материал ашылмады");
          return NextResponse.redirect(data.signedUrl);
        }
        const bytes = isNetlify()
          ? Buffer.from(
              await materialStore().get(material.id, { type: "arrayBuffer" }),
            )
          : await readFile(
              join(
                process.env.BAGDAR_DATA_DIR || join(process.cwd(), ".data"),
                "materials",
                material.id,
              ),
            );
        return new NextResponse(bytes, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(material.filename)}`,
            "Cache-Control": "private, no-store",
            "Content-Security-Policy": "sandbox",
          },
        });
      }
      if (path === "pdf" && req.method === "GET") {
        const attempt = await s.get(
          "attempts",
          req.nextUrl.searchParams.get("id") || "",
        );
        if (!attempt?.result) throw new HttpError("Нәтиже табылмады", 404);
        const student = await studentAccess(s, u, attempt.owner);
        const org = await s.get("organizations", attempt.org);
        const { makePDF } = await import("@/lib/pdf");
        const bytes = await makePDF(student, attempt.result, org?.name || "");
        return new NextResponse(new Uint8Array(bytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="Bagdar-result.pdf"',
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (path === "export" && req.method === "GET") {
        if (!["specialist", "teacher"].includes(u.role))
          throw new HttpError("Рұқсат жоқ", 403);
        const state = await getState(s, u);
        const safe = (s: string) => (/^[=+\-@\t\r\n]/.test(s) ? "'" + s : s);
        const rows = state.users
          .filter((x) => x.role === "student")
          .map((student) => {
            const a = state.attempts
              .filter((a) => a.owner === student.id && a.status === "completed")
              .sort((a, b) =>
                (b.completedAt || "").localeCompare(a.completedAt || ""),
              )[0];
            return {
              Оқушы: safe(student.name),
              Сынып: safe(
                state.classes.find((c) => c.id === student.classId)?.name ||
                  "—",
              ),
              Мәртебе: a ? "Аяқталды" : "Басталмады",
              Мамандық: a?.result?.top[0]?.name || "—",
              Көрсеткіш: a ? Math.round(a.result!.top[0].index) : "—",
              Күні: a?.completedAt || "—",
              Әдістеме: a?.result?.methodology || "—",
            };
          });
        const { default: ExcelJS } = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Нәтижелер");
        if (rows.length) {
          sheet.columns = Object.keys(rows[0]).map((key) => ({
            header: key,
            key,
            width: 25,
          }));
          rows.forEach((row) => sheet.addRow(row));
        }
        const bytes = await workbook.xlsx.writeBuffer();
        return new NextResponse(new Uint8Array(bytes), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="Bagdar-results.xlsx"',
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (path === "import-preview" && req.method === "POST") {
        if (u.role !== "specialist") throw new HttpError("Рұқсат жоқ", 403);
        const form = await req.formData();
        const file = form.get("file");
        if (
          !(file instanceof File) ||
          file.size > 5 * 1024 * 1024 ||
          !/\.(csv|xlsx)$/i.test(file.name)
        )
          throw new HttpError("CSV немесе XLSX файлын таңдаңыз (5 МБ дейін)");
        let input: Record<string, string>[];
        try {
          const { readImport } = await import("@/lib/import");
          input = await readImport(file);
        } catch {
          throw new HttpError(
            "Файл құрылымы немесе көлемі қате. Үлгіні қолданыңыз; формулаларға рұқсат жоқ",
          );
        }
        if (
          input.some((row) =>
            Object.keys(row).some(
              (k) => !["Аты", "Тегі", "Сынып", "Логин", "Рөлі"].includes(k),
            ),
          )
        )
          throw new HttpError("Файлда рұқсат етілмеген бағандар бар");
        if (input.length > 1000)
          throw new HttpError("1000 жолдан көп жүктеуге болмайды");
        const users = await s.all("users"),
          classes = (await s.all("classes")).filter((c) => c.org === u.org);
        const seen = new Set<string>();
        const rows = input.map((row, i) => {
          const name =
            String(row["Аты"] || "").trim() +
            " " +
            String(row["Тегі"] || "").trim();
          const login =
            String(row["Логин"] || "")
              .trim()
              .toLowerCase() || `oqushy.${randomBytes(4).toString("hex")}`;
          const cl = classes.find(
            (c) => c.name === String(row["Сынып"] || "").trim(),
          );
          const errors = [];
          if (!row["Аты"] || !row["Тегі"])
            errors.push("Аты мен тегін толтырыңыз");
          if (!/^[a-z0-9._-]{3,40}$/.test(login))
            errors.push("Логин форматы қате");
          if (users.some((u) => u.login === login) || seen.has(login))
            errors.push("Логин қайталанады");
          seen.add(login);
          if (!cl) errors.push("Сынып табылмады");
          if (row["Рөлі"] && row["Рөлі"] !== "Оқушы")
            errors.push("Тек оқушылар импорты қолжетімді");
          return { line: i + 2, name, login, classId: cl?.id || "", errors };
        });
        return json({ rows, key: randomBytes(16).toString("hex") });
      }
      throw new HttpError("Бет табылмады", 404);
    });
  } catch (e) {
    if (e instanceof Error && ["TimeoutError", "AbortError"].includes(e.name))
      return json(
        {
          error:
            "Сервер деректерді уақытында жүктей алмады. Біраздан соң қайта көріңіз.",
        },
        503,
      );
    if (e instanceof z.ZodError)
      return json(
        {
          error:
            "Деректерді тексеріңіз: өрістер толық әрі дұрыс толтырылуы керек",
        },
        400,
      );
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof Error && /Дерек өзгерді/.test(e.message))
      return json({ error: e.message }, 409);
    console.error(
      "Bagdar request failed",
      e instanceof Error ? e.name : "unknown",
    );
    return json({ error: "Сұрау орындалмады. Қайта көріңіз" }, 500);
  }
}
export const GET = handler;
export const POST = handler;
