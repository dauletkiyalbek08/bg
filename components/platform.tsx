"use client";
import {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { motion, MotionConfig } from "motion/react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  Compass,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  LayoutDashboard,
  ClipboardList,
  ChartNoAxesCombined,
  BookOpen,
  CalendarDays,
  Users,
  GraduationCap,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Search,
  Plus,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Heart,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Building2,
  FileUp,
  KeyRound,
  LockKeyhole,
  Target,
  Lightbulb,
  Globe,
  BriefcaseBusiness,
  FileQuestion,
  Printer,
  RefreshCw,
  CheckCheck,
  AlertCircle,
  Eye,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/date";
import { labels, scales, surveyFields } from "@/lib/content";
import {
  roleNames,
  type Career,
  type Attempt,
  type Question,
} from "@/lib/types";
import type { getState } from "@/lib/service";
type State = Awaited<ReturnType<typeof getState>>;
type View =
  | "home"
  | "survey"
  | "test"
  | "results"
  | "careers"
  | "trainings"
  | "users"
  | "classes"
  | "assignments"
  | "analytics"
  | "questions"
  | "organizations"
  | "import"
  | "settings";
const navItems: {
  id: View;
  label: string;
  icon: LucideIcon;
  roles: string[];
}[] = [
  {
    id: "home",
    label: "Басты бет",
    icon: LayoutDashboard,
    roles: ["student", "teacher", "specialist", "superadmin"],
  },
  { id: "survey", label: "Сауалнама", icon: ClipboardList, roles: ["student"] },
  { id: "test", label: "Менің тестім", icon: Compass, roles: ["student"] },
  {
    id: "results",
    label: "Нәтижелер",
    icon: ChartNoAxesCombined,
    roles: ["student", "teacher", "specialist"],
  },
  {
    id: "careers",
    label: "Мамандықтар",
    icon: BriefcaseBusiness,
    roles: ["student", "teacher", "specialist", "superadmin"],
  },
  {
    id: "trainings",
    label: "Тренингтер",
    icon: CalendarDays,
    roles: ["student", "teacher", "specialist"],
  },
  {
    id: "users",
    label: "Пайдаланушылар",
    icon: Users,
    roles: ["specialist", "superadmin"],
  },
  {
    id: "classes",
    label: "Сыныптар",
    icon: GraduationCap,
    roles: ["teacher", "specialist"],
  },
  {
    id: "assignments",
    label: "Тест тағайындау",
    icon: FileQuestion,
    roles: ["specialist"],
  },
  {
    id: "questions",
    label: "Сұрақтар банкі",
    icon: BookOpen,
    roles: ["specialist", "superadmin"],
  },
  { id: "import", label: "Импорт", icon: FileUp, roles: ["specialist"] },
  {
    id: "analytics",
    label: "Аналитика",
    icon: ChartNoAxesCombined,
    roles: ["teacher", "specialist"],
  },
  {
    id: "organizations",
    label: "Ұйымдар",
    icon: Building2,
    roles: ["superadmin"],
  },
  {
    id: "settings",
    label: "Баптаулар",
    icon: Settings,
    roles: ["student", "teacher", "specialist", "superadmin"],
  },
];
const answers = [
  "Мүлдем мен туралы емес",
  "Көбіне жоқ",
  "Білмеймін",
  "Көбіне иә",
  "Дәл мен туралы",
];
const date = formatDate;
async function request(path: string, body?: unknown) {
  const response = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Сұрау орындалмады");
  return data;
}
function Btn({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
  icon: Icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  icon?: LucideIcon;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={"btn " + (secondary ? "secondary" : "primary")}
    >
      {Icon && <Icon size={17} />} {children}
    </button>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({
  title = "Әзірге дерек жоқ",
  text = "Жаңа мүмкіндіктер осы жерде пайда болады.",
  icon: Icon = Compass,
}: {
  title?: string;
  text?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={30} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const el = ref.current;
    el?.querySelector<HTMLElement>("button,input,select,textarea")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && el) {
        const controls = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input,select,textarea,a[href]",
          ),
        );
        if (e.shiftKey && document.activeElement === controls[0]) {
          e.preventDefault();
          controls.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === controls.at(-1)) {
          e.preventDefault();
          controls[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
      old?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Жабу">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Logo() {
  return (
    <div className="logo">
      <span className="logo-symbol">
        <Compass size={25} strokeWidth={2.1} />
      </span>
      <span>
        Bagdar<span className="logo-dot">.</span>
      </span>
    </div>
  );
}
function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      window.addEventListener("bagdar-theme", cb);
      return () => window.removeEventListener("bagdar-theme", cb);
    },
    () => localStorage.getItem("bagdar-theme") || "system",
    () => "system",
  );
  return [
    theme,
    (value: string) => {
      localStorage.setItem("bagdar-theme", value);
      window.dispatchEvent(new Event("bagdar-theme"));
    },
  ] as const;
}
export default function Platform({ demoAllowed }: { demoAllowed: boolean }) {
  const [theme, setTheme] = useTheme();
  const [snapshot, setState] = useState<State | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [view, setView] = useState<View>("home"),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<ReactNode>(null),
    [career, setCareer] = useState<Career | null>(null),
    [selectedAttempt, setSelectedAttempt] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [credentials, setCredentials] = useState<
      { login: string; password: string }[] | null
    >(null);
  async function reload() {
    const data = await request("state");
    setState(data);
    return data as State;
  }
  useEffect(() => {
    request("state")
      .then(setState)
      .catch((e) => {
        if (e.message !== "Жүйеге кіріңіз") setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (mq.matches ? "dark" : "light") : theme);
    apply();
    mq.addEventListener("change", apply);
    localStorage.setItem("bagdar-theme", theme);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(next: View) {
    setView(next);
    setSearch("");
    setFilter("");
    setMenu(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function act(body: Record<string, unknown>, success = "Сақталды") {
    setBusy(true);
    setError("");
    try {
      const result = await request("action", body);
      if (result.credentials) setCredentials([result.credentials]);
      if (result.credentialsList) setCredentials(result.credentialsList);
      if (result.relogin) {
        setState(null);
        setToast("Құпиясөз өзгерді. Қайта кіріңіз");
        return result;
      }
      await reload();
      if (success) setToast(success);
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await request("logout", {});
    setState(null);
    go("home");
  }
  function formAction(
    action: string,
    extra: Record<string, unknown> = {},
    transform?: (data: Record<string, unknown>) => Record<string, unknown>,
  ) {
    return async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const element = e.currentTarget;
      if (element.dataset.submitting === "true") return;
      element.dataset.submitting = "true";
      const button = element.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      if (button) button.disabled = true;
      const form = Object.fromEntries(new FormData(element));
      try {
        await act({
          action,
          ...(transform ? transform(form) : form),
          ...extra,
        });
        setModal(null);
      } catch {
      } finally {
        element.dataset.submitting = "false";
        if (button) button.disabled = false;
      }
    };
  }
  if (loading)
    return (
      <div className="loading-screen">
        <Logo />
        <div className="loader" />
        <p>Бағытыңды дайындап жатырмыз…</p>
      </div>
    );
  if (!snapshot)
    return (
      <Login
        demoAllowed={demoAllowed}
        onLogin={async (body) => {
          setBusy(true);
          setError("");
          try {
            await request("login", body);
            await reload();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        error={error}
        busy={busy}
      />
    );
  const state = snapshot;
  const u = state.user;
  const isStaff = ["specialist", "teacher"].includes(u.role),
    canManage = u.role === "specialist" || u.role === "superadmin";
  const students = state.users.filter((x) => x.role === "student");
  const ownAttempts = state.attempts.filter((a) => a.owner === u.id);
  const completed = state.attempts.filter((a) => a.status === "completed");
  const latest = completed
    .filter((a) => u.role !== "student" || a.owner === u.id)
    .sort((a, b) =>
      (b.completedAt || "").localeCompare(a.completedAt || ""),
    )[0];
  const chosen = state.attempts.find((a) => a.id === selectedAttempt) || latest;
  const firstName = u.name.split(" ")[0];
  const nav = navItems.filter((n) => n.roles.includes(u.role));
  const pageTitle = nav.find((n) => n.id === view)?.label || "Басты бет";
  function openUser() {
    setModal(
      <Modal title="Жаңа пайдаланушы" onClose={() => setModal(null)}>
        <form onSubmit={formAction("user-create")} className="form-stack">
          <Field label="Аты-жөні">
            <input name="name" required minLength={2} />
          </Field>
          <Field label="Логин (бос қалдырсаңыз, автоматты жасалады)">
            <input name="login" pattern="[a-zA-Z0-9._-]{3,40}" />
          </Field>
          {u.role === "superadmin" ? (
            <>
              <input type="hidden" name="role" value="specialist" />
              <Field label="Ұйым">
                <select name="org" required>
                  {state.organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Рөлі">
                <select name="role">
                  <option value="student">Оқушы</option>
                  <option value="teacher">Сынып жетекшісі</option>
                </select>
              </Field>
              <Field label="Сынып">
                <select name="classId">
                  <option value="">Тағайындалмаған</option>
                  {state.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Btn type="submit" disabled={busy}>
            Аккаунт жасау
          </Btn>
        </form>
      </Modal>,
    );
  }
  function openClass(c?: State["classes"][number]) {
    setModal(
      <Modal
        title={c ? "Сыныпты өзгерту" : "Жаңа сынып"}
        onClose={() => setModal(null)}
      >
        <form
          className="form-stack"
          onSubmit={formAction("class", c ? { id: c.id } : {})}
        >
          <Field label="Сынып атауы">
            <input
              name="name"
              required
              defaultValue={c?.name}
              placeholder="9 «А»"
            />
          </Field>
          <Field label="Сынып жетекшісі">
            <select name="teacherId" defaultValue={c?.teacherId || ""}>
              <option value="">Тағайындалмаған</option>
              {state.users
                .filter((x) => x.role === "teacher")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </Field>
          <Btn type="submit" disabled={busy}>
            Сақтау
          </Btn>
        </form>
      </Modal>,
    );
  }
  function openAssignment() {
    setModal(
      <Modal title="Тест тағайындау" onClose={() => setModal(null)}>
        <form
          className="form-stack"
          onSubmit={formAction("assign", {}, (f) => ({
            ...f,
            closesAt: f.closesAt
              ? new Date(String(f.closesAt)).toISOString()
              : null,
          }))}
        >
          <Field label="Тест атауы">
            <input name="title" required defaultValue="Өз бағытыңды тап" />
          </Field>
          <Field label="Сынып">
            <select name="classId">
              <option value="">Барлық сыныптар</option>
              {state.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Жеке оқушы (міндетті емес)">
            <select name="owner">
              <option value="">Сынып бойынша</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Аяқталу мерзімі (міндетті емес)">
            <input type="datetime-local" name="closesAt" />
          </Field>
          <Btn type="submit" disabled={busy}>
            Тағайындау
          </Btn>
        </form>
      </Modal>,
    );
  }
  function openTraining() {
    setModal(
      <Modal title="Жаңа тренинг" onClose={() => setModal(null)}>
        <form
          className="form-stack"
          onSubmit={formAction("training", {}, (f) => ({
            ...f,
            date: new Date(String(f.date)).toISOString(),
            classIds: [String(f.classId)],
          }))}
        >
          <Field label="Тақырыбы">
            <input name="title" required />
          </Field>
          <Field label="Сипаттамасы">
            <textarea name="description" required rows={3} />
          </Field>
          <Field label="Күні мен уақыты">
            <input type="datetime-local" name="date" required />
          </Field>
          <Field label="Сынып">
            <select name="classId" required>
              {state.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Материал сілтемесі (HTTPS)">
            <input type="url" name="url" placeholder="https://" />
          </Field>
          <Btn type="submit" disabled={busy}>
            Жариялау
          </Btn>
        </form>
      </Modal>,
    );
  }
  function openOrg(o?: State["organizations"][number]) {
    setModal(
      <Modal
        title={o ? "Ұйымды баптау" : "Жаңа ұйым"}
        onClose={() => setModal(null)}
      >
        <form
          className="form-stack"
          onSubmit={formAction("organization", o ? { id: o.id } : {}, (f) => ({
            ...f,
            limit: Number(f.limit),
          }))}
        >
          <Field label="Ұйым атауы">
            <input name="name" required defaultValue={o?.name} />
          </Field>
          <Field label="Қала">
            <input name="city" defaultValue={o?.city} />
          </Field>
          <Field label="Оқушылар лимиті">
            <input
              type="number"
              name="limit"
              min={1}
              defaultValue={o?.limit || 100}
            />
          </Field>
          <Field label="Мәртебе">
            <select name="status" defaultValue={o?.status || "active"}>
              <option value="active">Белсенді</option>
              <option value="suspended">Тоқтатылған</option>
              <option value="archived">Мұрағатта</option>
            </select>
          </Field>
          <Btn type="submit" disabled={busy}>
            Сақтау
          </Btn>
        </form>
      </Modal>,
    );
  }
  function openQuestion(q?: Question) {
    setModal(
      <Modal
        title={q ? "Сұрақты өзгерту" : "Жаңа сұрақ"}
        onClose={() => setModal(null)}
      >
        <QuestionForm
          question={q}
          busy={busy}
          onSave={async (fields) => {
            await act({
              action: "question",
              ...fields,
              ...(q ? { id: q.id } : {}),
            });
            setModal(null);
          }}
        />
      </Modal>,
    );
  }
  function openCareer(c?: Career) {
    setModal(
      <Modal
        wide
        title={c ? "Мамандықты өзгерту" : "Жаңа мамандық"}
        onClose={() => setModal(null)}
      >
        <CareerForm
          career={c}
          busy={busy}
          onSave={async (fields) => {
            await act({
              action: "career",
              ...fields,
              ...(c ? { id: c.id } : {}),
            });
            setModal(null);
          }}
        />
      </Modal>,
    );
  }
  function tools(placeholder = "Іздеу…", options?: string[]) {
    return (
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label={placeholder}
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {options && (
          <select
            aria-label="Сүзгі"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Барлығы</option>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        )}
      </div>
    );
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <aside className={"sidebar " + (menu ? "open" : "")}>
          <div className="sidebar-head">
            <Logo />
            <button
              className="icon-btn mobile-only"
              onClick={() => setMenu(false)}
              aria-label="Мәзірді жабу"
            >
              <X />
            </button>
          </div>
          <div className="workspace-badge">
            <span className="workspace-icon">
              <GraduationCap size={18} />
            </span>
            <div>
              <b>{state.organization?.name || "Платформа басқаруы"}</b>
              <small>{roleNames[u.role]}</small>
            </div>
          </div>
          <span className="nav-caption">МЕНІҢ КЕҢІСТІГІМ</span>
          <nav aria-label="Негізгі мәзір">
            {nav
              .filter((n) => n.id !== "settings")
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={view === id ? "nav-item active" : "nav-item"}
                  onClick={() => go(id)}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                  {id === "test" && <span className="nav-dot" />}
                </button>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <Sparkles size={21} />
              <p>
                Үлкен болашақ
                <br />
                <b>кішкентай қадамнан.</b>
              </p>
              <span>Өзіңді зерттеуден баста</span>
            </div>
            <button
              className={"nav-item " + (view === "settings" ? "active" : "")}
              onClick={() => go("settings")}
            >
              <Settings size={20} />
              Баптаулар
            </button>
            <button className="nav-item" onClick={() => void logout()}>
              <LogOut size={20} />
              Шығу
            </button>
          </div>
        </aside>
        {menu && (
          <button
            className="mobile-scrim"
            aria-label="Мәзірді жабу"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumbs">
              <button
                className="icon-btn mobile-only"
                onClick={() => setMenu(true)}
                aria-label="Мәзірді ашу"
              >
                <Menu />
              </button>
              <span>Менің кеңістігім</span>
              <ChevronRight size={14} />
              <b>{pageTitle}</b>
            </div>
            <div className="topbar-right">
              <span className="date-label">
                {date(new Date().toISOString())}
              </span>
              <button
                className="icon-btn"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Тақырыпты ауыстыру"
              >
                {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <span className="topbar-divider" />
              <div className="avatar">{firstName.charAt(0)}</div>
              <div className="user-caption">
                <b>{u.name}</b>
                <small>{roleNames[u.role]}</small>
              </div>
            </div>
          </header>
          <main id="main-content" className="main-content">
            {state.demo && (
              <div className="demo-strip">
                <span className="status-dot" /> Демо кеңістік <span>•</span> Тек
                ойдан шығарылған деректер
              </div>
            )}
            {state.organization?.status === "suspended" && (
              <div className="notice warning">
                Ұйымның жазылымы тоқтатылған. Нәтижелерді көруге болады;
                өзгерістер уақытша қолжетімсіз.
              </div>
            )}
            {error && (
              <div className="notice error" role="alert">
                <AlertCircle size={19} />
                <span>{error}</span>
                <button
                  className="icon-btn"
                  onClick={() => setError("")}
                  aria-label="Жабу"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {u.mustChange ? (
              <section className="card narrow">
                <KeyRound size={36} className="purple" />
                <h1>Жаңа құпиясөз орнатыңыз</h1>
                <p>
                  Аккаунтыңыздың қауіпсіздігі үшін уақытша құпиясөзді
                  ауыстырыңыз.
                </p>
                <form className="form-stack" onSubmit={formAction("password")}>
                  <Field label="Жаңа құпиясөз (кемінде 12 таңба)">
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Btn type="submit" disabled={busy}>
                    Құпиясөзді өзгерту
                  </Btn>
                </form>
              </section>
            ) : (
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {view === "home" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">БҮГІН — ЖАҢА МҮМКІНДІК</div>
                        <h1>
                          Сәлем, {firstName}! <span className="wave">✦</span>
                        </h1>
                        <p>
                          {u.role === "student"
                            ? "Өзіңді таны. Мүмкіндіктеріңді аш. Өз бағытыңды тап."
                            : "Оқушылардың болашағына бірге бағыт берейік."}
                        </p>
                      </div>
                      <span className="rounded-label">
                        <span className="status-dot" /> Сенің болашағың осында
                      </span>
                    </div>
                    <div className="hero">
                      <div className="hero-copy">
                        <span className="hero-kicker">
                          <Sparkles size={15} /> БОЛАШАҒЫҢДЫ ЗЕРТТЕ
                        </span>
                        <h2>
                          {u.role === "student" ? (
                            <>
                              Сенің жолың.
                              <br />
                              Сенің <span>таңдауың.</span>
                            </>
                          ) : (
                            <>
                              Әр оқушының
                              <br />
                              <span>өз бағыты бар.</span>
                            </>
                          )}
                        </h2>
                        <p>
                          {u.role === "student"
                            ? "Қай мамандық саған жақын? Қызығушылықтарың мен дағдыларыңды зерттеп, алғашқы қадамыңды жаса."
                            : "Қызығушылықтарды зерттеп, нәтижелерді талқылап, жаңа мүмкіндіктерге жол ашыңыз."}
                        </p>
                        <button
                          className="hero-btn"
                          onClick={() =>
                            go(
                              u.role === "student"
                                ? "test"
                                : u.role === "superadmin"
                                  ? "organizations"
                                  : "analytics",
                            )
                          }
                        >
                          {u.role === "student"
                            ? "Бағытымды табу"
                            : "Басқаруға өту"}
                          <ArrowUpRight size={19} />
                        </button>
                        <span className="hero-footnote">
                          <ShieldCheck size={14} />{" "}
                          {u.role === "student"
                            ? "Дұрыс не қате жауап жоқ. Тек сенің ойың маңызды."
                            : "Қауіпсіз кеңістік. Деректер ұйым ішінде қорғалған."}
                        </span>
                      </div>
                      <div className="hero-art" aria-hidden="true">
                        <div className="orbit orbit-one" />
                        <div className="orbit orbit-two" />
                        <div className="orbit orbit-three" />
                        <div className="spark spark-one">✦</div>
                        <div className="spark spark-two">✦</div>
                        <div className="floating-pill pill-one">
                          <Lightbulb size={18} /> Жаңа идеялар
                        </div>
                        <div className="compass-art">
                          <div className="compass-inner">
                            <span className="compass-n">С</span>
                            <span className="compass-e">Ш</span>
                            <span className="compass-s">О</span>
                            <span className="compass-w">Б</span>
                            <div className="needle" />
                            <span className="compass-center" />
                          </div>
                        </div>
                        <div className="floating-pill pill-two">
                          <Target size={18} /> Өз бағытың
                        </div>
                        <div className="art-tiny-dot" />
                      </div>
                    </div>
                    <div className="stats-grid">
                      {(u.role === "student"
                        ? [
                            {
                              icon: ClipboardList,
                              label: "Сауалнама",
                              value: state.surveys.find((s) => s.owner === u.id)
                                ?.complete
                                ? "Толтырылды"
                                : "Алғашқы қадам",
                              tone: "mint",
                            },
                            {
                              icon: Compass,
                              label: "Кәсіби бағдар тесті",
                              value: ownAttempts.some(
                                (a) => a.status === "completed",
                              )
                                ? "Аяқталды"
                                : "36 сұрақ",
                              tone: "purple",
                            },
                            {
                              icon: BriefcaseBusiness,
                              label: "Мамандықтар әлемі",
                              value: `${state.careers.filter((c) => c.active).length} мамандық`,
                              tone: "orange",
                            },
                            {
                              icon: CalendarDays,
                              label: "Жаңа тәжірибелер",
                              value: `${state.trainings.filter((t) => new Date(t.date) > new Date()).length} тренинг`,
                              tone: "pink",
                            },
                          ]
                        : [
                            {
                              icon: Users,
                              label: "Оқушылар",
                              value: String(students.length),
                              tone: "purple",
                            },
                            {
                              icon: GraduationCap,
                              label:
                                u.role === "superadmin"
                                  ? "Ұйымдар"
                                  : "Сыныптар",
                              value: String(
                                u.role === "superadmin"
                                  ? state.organizations.length
                                  : state.classes.length,
                              ),
                              tone: "mint",
                            },
                            {
                              icon: CheckCheck,
                              label: "Аяқталған тест",
                              value: String(completed.length),
                              tone: "orange",
                            },
                            {
                              icon: BookOpen,
                              label: "Сұрақтар банкі",
                              value: String(
                                state.questions.length ||
                                  state.assignments.length,
                              ),
                              tone: "pink",
                            },
                          ]
                      ).map(({ icon: Icon, label, value, tone }, i) => (
                        <button
                          className="stat-card"
                          key={label}
                          onClick={() =>
                            go(
                              (u.role === "student"
                                ? ["survey", "test", "careers", "trainings"]
                                : u.role === "superadmin"
                                  ? [
                                      "users",
                                      "organizations",
                                      "organizations",
                                      "questions",
                                    ]
                                  : u.role === "teacher"
                                    ? [
                                        "classes",
                                        "classes",
                                        "results",
                                        "analytics",
                                      ]
                                    : [
                                        "users",
                                        "classes",
                                        "results",
                                        "questions",
                                      ])[i] as View,
                            )
                          }
                        >
                          <div className={"stat-icon " + tone}>
                            <Icon size={22} />
                          </div>
                          <div>
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </div>
                          <ArrowUpRight size={17} className="stat-arrow" />
                        </button>
                      ))}
                    </div>
                    <div className="home-columns">
                      <section className="card journey-card">
                        <div className="section-heading">
                          <div>
                            <h2>
                              {u.role === "student"
                                ? "Сенің жол картасы"
                                : "Оқушылардың бағыты"}
                            </h2>
                            <p>
                              {u.role === "student"
                                ? "Өзіңді тануға арналған 3 қарапайым қадам"
                                : "Нәтиже — әңгіме бастауға арналған мүмкіндік"}
                            </p>
                          </div>
                          <span className="tag purple">Бірге алға</span>
                        </div>
                        {u.role === "student" ? (
                          <div className="journey-list">
                            {[
                              {
                                title: "Өзің туралы айтып бер",
                                text: "Қызығушылықтар мен сүйікті істерің",
                                done: !!state.surveys.find(
                                  (s) => s.owner === u.id,
                                )?.complete,
                                target: "survey",
                              },
                              {
                                title: "Қызығушылықтарыңды зертте",
                                text: "36 сұрақ · өзіңе ыңғайлы қарқында",
                                done: ownAttempts.some(
                                  (a) => a.status === "completed",
                                ),
                                target: "test",
                              },
                              {
                                title: "Мүмкіндіктеріңді аш",
                                text: "Саған жақын мамандықтар мен ұсыныстар",
                                done: !!latest,
                                target: "results",
                              },
                            ].map((step, i) => (
                              <button
                                className="journey-step"
                                key={step.title}
                                onClick={() => go(step.target as View)}
                              >
                                <span
                                  className={
                                    "step-number " + (step.done ? "done" : "")
                                  }
                                >
                                  {step.done ? (
                                    <Check size={18} />
                                  ) : (
                                    String(i + 1).padStart(2, "0")
                                  )}
                                </span>
                                <div>
                                  <b>{step.title}</b>
                                  <p>{step.text}</p>
                                </div>
                                <ArrowUpRight size={18} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="mini-table">
                              {students.slice(0, 4).map((s) => (
                                <button
                                  className="student-line"
                                  key={s.id}
                                  onClick={() => {
                                    setSelectedAttempt(
                                      completed.find((a) => a.owner === s.id)
                                        ?.id || "",
                                    );
                                    go("results");
                                  }}
                                >
                                  <span className="avatar small">
                                    {s.name[0]}
                                  </span>
                                  <b>{s.name}</b>
                                  <span
                                    className={
                                      "tag " +
                                      (completed.some((a) => a.owner === s.id)
                                        ? "mint"
                                        : "neutral")
                                    }
                                  >
                                    {completed.some((a) => a.owner === s.id)
                                      ? "Аяқталды"
                                      : "Күтуде"}
                                  </span>
                                  <ChevronRight size={16} />
                                </button>
                              ))}
                            </div>
                            {!students.length && (
                              <Empty
                                title="Кеңістігіңді дайында"
                                text="Ұйым немесе пайдаланушыларды қосып баста."
                              />
                            )}
                          </>
                        )}
                      </section>
                      <section className="card discovery-card">
                        <span className="section-kicker">
                          <Sparkles size={15} /> ӨЗІҢЕ МҮМКІНДІК БЕР
                        </span>
                        <div className="discovery-symbol">✳︎</div>
                        <h2>
                          {latest
                            ? "Алғашқы бағытың дайын!"
                            : "Бір ғана дұрыс жол жоқ."}
                        </h2>
                        <p>
                          {latest
                            ? "Нәтижең — соңғы шешім емес, жаңа идеяларға бастайтын бағдар."
                            : "Қызығушылықтарың өзгеруі мүмкін. Зертте, байқап көр, үйрен."}
                        </p>
                        <button
                          className="text-link"
                          onClick={() => go(latest ? "results" : "careers")}
                        >
                          {latest ? "Нәтижені көру" : "Мамандықтарды зерттеу"}
                          <ArrowRight size={17} />
                        </button>
                      </section>
                    </div>
                    <div className="section-heading outside">
                      <div>
                        <h2>Алдағы тренингтер</h2>
                        <p>Жаңа дағдылар. Жаңа таныстықтар. Жаңа сен.</p>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => go("trainings")}
                      >
                        Барлығын көру
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="training-grid">
                      {state.trainings
                        .filter((t) => new Date(t.date) > new Date())
                        .slice(0, 2)
                        .map((t, i) => (
                          <button
                            className={
                              "training-preview " + (i ? "peach" : "lavender")
                            }
                            key={t.id}
                            onClick={() => go("trainings")}
                          >
                            <span className="training-visual">
                              <span>{i ? "✺" : "✳︎"}</span>
                            </span>
                            <div>
                              <span className="tag white">Тренинг</span>
                              <h3>{t.title}</h3>
                              <p>
                                <CalendarDays size={14} />
                                {date(t.date)}
                              </p>
                            </div>
                            <ArrowUpRight size={22} />
                          </button>
                        ))}
                    </div>
                  </>
                )}
                {view === "survey" && (
                  <>
                    <PageHead
                      eyebrow="АЛҒАШҚЫ ҚАДАМ"
                      title="Өзің туралы айтып бер"
                      text="Мұнда дұрыс не қате жауап жоқ. Өзіңе жақын жауапты таңда."
                    />
                    <SurveyEditor
                      state={state}
                      busy={busy}
                      onSave={async (answers, complete, consent) => {
                        await act({
                          action: "survey",
                          answers,
                          complete,
                          consent,
                        });
                        if (complete) go("test");
                      }}
                    />
                  </>
                )}
                {view === "test" && (
                  <>
                    <PageHead
                      eyebrow="ҚЫЗЫҒУШЫЛЫҚТАР КАРТАСЫ"
                      title="Өз бағытыңды зертте"
                      text="Асықпа. Өзіңе шынайы жауап бер. Қажет болса, кейін жалғастыра аласың."
                    />
                    <TestArea
                      state={state}
                      act={act}
                      busy={busy}
                      onSurvey={() => go("survey")}
                      onResult={(id) => {
                        setSelectedAttempt(id);
                        go("results");
                      }}
                    />
                  </>
                )}
                {view === "results" && (
                  <>
                    <PageHead
                      eyebrow="ӨЗІҢДІ ТАНУҒА АРНАЛҒАН БАҒДАР"
                      title={
                        u.role === "student"
                          ? "Сенің мүмкіндіктер картаң"
                          : "Оқушылардың нәтижелері"
                      }
                      text="Нәтиже — соңғы шешім емес. Ол келесі қадамды таңдауға көмектеседі."
                    />
                    {completed.length ? (
                      <>
                        <div className="toolbar">
                          <select
                            aria-label="Нәтижені таңдау"
                            value={chosen?.id || ""}
                            onChange={(e) => setSelectedAttempt(e.target.value)}
                          >
                            {completed.map((a) => (
                              <option key={a.id} value={a.id}>
                                {
                                  state.users.find((s) => s.id === a.owner)
                                    ?.name
                                }{" "}
                                · {date(a.completedAt!)} ·{" "}
                                {
                                  state.assignments.find(
                                    (x) => x.id === a.assignmentId,
                                  )?.title
                                }
                              </option>
                            ))}
                          </select>
                          {chosen && (
                            <a
                              className="btn secondary"
                              href={"/api/pdf?id=" + chosen.id}
                            >
                              <Download size={17} />
                              PDF жүктеу
                            </a>
                          )}
                        </div>
                        {chosen?.result && (
                          <ResultView
                            attempt={chosen}
                            state={state}
                            onCareer={(id) =>
                              setCareer(
                                state.careers.find((c) => c.id === id) || null,
                              )
                            }
                          />
                        )}
                        <section className="card">
                          <h2>Пікірлер</h2>
                          {state.comments
                            .filter((c) => c.owner === chosen?.owner)
                            .map((c) => (
                              <div className="comment" key={c.id}>
                                <b>{c.authorName}</b>
                                <small>
                                  {date(c.createdAt)} ·{" "}
                                  {c.visibility === "staff"
                                    ? "Тек мамандарға"
                                    : "Оқушыға көрінеді"}
                                </small>
                                <p>{c.text}</p>
                              </div>
                            ))}
                          {isStaff && chosen && (
                            <form
                              className="form-stack"
                              onSubmit={formAction("comment", {
                                owner: chosen.owner,
                              })}
                            >
                              <Field label="Жаңа пікір">
                                <textarea
                                  name="text"
                                  required
                                  maxLength={2000}
                                />
                              </Field>
                              <select
                                name="visibility"
                                aria-label="Пікірдің көрінуі"
                              >
                                <option value="student">
                                  Оқушыға көрінеді
                                </option>
                                <option value="staff">Тек мамандарға</option>
                              </select>
                              <Btn type="submit" disabled={busy}>
                                Пікір қосу
                              </Btn>
                            </form>
                          )}
                          {!state.comments.some(
                            (c) => c.owner === chosen?.owner,
                          ) &&
                            !isStaff && (
                              <p className="muted">
                                Маманның пікірі осы жерде пайда болады.
                              </p>
                            )}
                        </section>
                      </>
                    ) : (
                      <Empty
                        title="Нәтиже әлі жоқ"
                        text="Тест аяқталғаннан кейін қызығушылықтар картасы осы жерде пайда болады."
                      />
                    )}
                  </>
                )}
                {view === "careers" && (
                  <>
                    <PageHead
                      eyebrow="МҮМКІНДІКТЕР ӘЛЕМІ"
                      title="Саған қай бағыт жақын?"
                      text="Мамандықтарды зертте. Қызықтысын сақта. Өзіңе жаңа жол аш."
                      action={
                        canManage ? (
                          <Btn icon={Plus} onClick={() => openCareer()}>
                            Мамандық қосу
                          </Btn>
                        ) : undefined
                      }
                    />
                    {tools("Мамандық іздеу…", [
                      ...new Set(state.careers.map((c) => c.sector)),
                    ])}
                    {u.role === "student" && (
                      <button
                        className={
                          "chip " + (filter === "favorites" ? "selected" : "")
                        }
                        onClick={() =>
                          setFilter(filter === "favorites" ? "" : "favorites")
                        }
                      >
                        <Heart size={15} />
                        Таңдаулылар ({state.favorites.length})
                      </button>
                    )}
                    <div className="career-grid">
                      {state.careers
                        .filter(
                          (c) =>
                            (c.name + " " + c.description)
                              .toLowerCase()
                              .includes(search.toLowerCase()) &&
                            (!filter ||
                              (filter === "favorites"
                                ? state.favorites.some(
                                    (f) => f.careerId === c.id,
                                  )
                                : c.sector === filter)),
                        )
                        .map((c, i) => (
                          <article className="career-card" key={c.id}>
                            <div className="career-card-top">
                              <span className={"career-symbol tone-" + (i % 5)}>
                                {i % 3 === 0 ? (
                                  <Lightbulb />
                                ) : i % 3 === 1 ? (
                                  <Globe />
                                ) : (
                                  <BriefcaseBusiness />
                                )}
                              </span>
                              {u.role === "student" && (
                                <button
                                  className={
                                    "icon-btn favorite " +
                                    (state.favorites.some(
                                      (f) => f.careerId === c.id,
                                    )
                                      ? "saved"
                                      : "")
                                  }
                                  aria-label="Таңдаулыға қосу немесе алу"
                                  onClick={() =>
                                    void act(
                                      { action: "favorite", careerId: c.id },
                                      "",
                                    ).catch(() => {})
                                  }
                                >
                                  <Heart size={19} />
                                </button>
                              )}
                            </div>
                            <span className="mini-label">{c.sector}</span>
                            <h3>{c.name}</h3>
                            <p>{c.description}</p>
                            <button
                              className="text-link"
                              onClick={() => setCareer(c)}
                            >
                              Толығырақ
                              <ArrowUpRight size={16} />
                            </button>
                            {canManage &&
                              (c.org === u.org || u.role === "superadmin") && (
                                <button
                                  className="text-link muted"
                                  onClick={() => openCareer(c)}
                                >
                                  Өзгерту
                                </button>
                              )}
                          </article>
                        ))}
                    </div>
                  </>
                )}
                {view === "trainings" && (
                  <>
                    <PageHead
                      eyebrow="БАЙҚАП КӨР. ҮЙРЕН. ДАМЫ."
                      title="Тренингтер мен сабақтар"
                      text="Қызығушылықтарыңды тәжірибеде тексеруге арналған кеңістік."
                      action={
                        u.role === "specialist" ? (
                          <Btn icon={Plus} onClick={openTraining}>
                            Тренинг қосу
                          </Btn>
                        ) : undefined
                      }
                    />
                    <div className="tabs">
                      {[
                        ["", "Барлығы"],
                        ["upcoming", "Алдағы"],
                        ["past", "Өткен"],
                      ].map(([v, l]) => (
                        <button
                          key={v}
                          className={filter === v ? "active" : ""}
                          onClick={() => setFilter(v)}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="training-grid">
                      {state.trainings
                        .filter(
                          (t) =>
                            !filter ||
                            (filter === "upcoming"
                              ? new Date(t.date) > new Date()
                              : new Date(t.date) <= new Date()),
                        )
                        .map((t, i) => (
                          <article className="card training-full" key={t.id}>
                            <div className={"training-banner tone-" + (i % 5)}>
                              <span>✳︎</span>
                              <span className="tag white">
                                {t.status === "cancelled"
                                  ? "Бас тартылды"
                                  : new Date(t.date) > new Date()
                                    ? "Алдағы тренинг"
                                    : "Өткен тренинг"}
                              </span>
                            </div>
                            <div className="training-body">
                              <small>
                                <CalendarDays size={14} />
                                {date(t.date)} ·{" "}
                                {new Intl.DateTimeFormat("kk-KZ", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Asia/Almaty",
                                }).format(new Date(t.date))}
                              </small>
                              <h2>{t.title}</h2>
                              <p>{t.description}</p>
                              <div className="tag-row">
                                {state.classes
                                  .filter((c) => t.classIds.includes(c.id))
                                  .map((c) => (
                                    <span className="tag neutral" key={c.id}>
                                      {c.name}
                                    </span>
                                  ))}
                              </div>
                              {t.url && (
                                <a
                                  className="btn secondary"
                                  href={t.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Материалды ашу
                                  <ArrowUpRight size={17} />
                                </a>
                              )}
                              <TrainingExtras
                                training={t}
                                state={state}
                                onReload={async () => {
                                  await reload();
                                  setToast("Материал сақталды");
                                }}
                                onFeedback={async (values) => {
                                  await act({
                                    action: "feedback",
                                    trainingId: t.id,
                                    ...values,
                                  });
                                }}
                              />
                              {u.role === "specialist" &&
                                t.status !== "cancelled" && (
                                  <button
                                    className="text-link"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "Тренингтен бас тарту керек пе?",
                                        )
                                      )
                                        void act({
                                          action: "training-cancel",
                                          id: t.id,
                                        }).catch(() => {});
                                    }}
                                  >
                                    Тренингтен бас тарту
                                  </button>
                                )}
                              {u.role === "student" && (
                                <p className="muted">
                                  Қатысу: {attendanceLabel(t.attendance[u.id])}
                                </p>
                              )}
                              {isStaff && (
                                <details>
                                  <summary>Қатысу тізімі</summary>
                                  {students
                                    .filter(
                                      (s) =>
                                        !!s.classId &&
                                        t.classIds.includes(s.classId),
                                    )
                                    .map((s) => (
                                      <div
                                        className="attendance-line"
                                        key={s.id}
                                      >
                                        <span>{s.name}</span>
                                        {u.role === "specialist" ? (
                                          <select
                                            aria-label={s.name + " қатысуы"}
                                            value={
                                              t.attendance[s.id] || "unknown"
                                            }
                                            onChange={(e) =>
                                              void act({
                                                action: "attendance",
                                                id: t.id,
                                                owner: s.id,
                                                value: e.target.value,
                                              }).catch(() => {})
                                            }
                                          >
                                            {[
                                              "unknown",
                                              "present",
                                              "absent",
                                              "excused",
                                            ].map((v) => (
                                              <option key={v} value={v}>
                                                {attendanceLabel(v)}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <span>
                                            {attendanceLabel(
                                              t.attendance[s.id],
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                </details>
                              )}
                            </div>
                          </article>
                        ))}
                    </div>
                    {!state.trainings.length && <Empty />}
                  </>
                )}
                {view === "users" && (
                  <>
                    <PageHead
                      title="Пайдаланушылар"
                      text="Аккаунттар, сыныптар және қауіпсіз кіру."
                      action={
                        <Btn icon={Plus} onClick={openUser}>
                          Пайдаланушы қосу
                        </Btn>
                      }
                    />
                    {tools("Аты немесе логині бойынша іздеу…")}
                    <div className="card table-card">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Аты-жөні</th>
                              <th>Рөлі</th>
                              <th>Сынып</th>
                              <th>Мәртебе</th>
                              <th>Әрекеттер</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.users
                              .filter((x) =>
                                (x.name + " " + x.login)
                                  .toLowerCase()
                                  .includes(search.toLowerCase()),
                              )
                              .map((x) => (
                                <tr key={x.id}>
                                  <td>
                                    <b>{x.name}</b>
                                    <small>{x.login}</small>
                                  </td>
                                  <td>{roleNames[x.role]}</td>
                                  <td>
                                    {state.classes.find(
                                      (c) => c.id === x.classId,
                                    )?.name || "—"}
                                  </td>
                                  <td>
                                    <span
                                      className={
                                        "tag " + (x.blocked ? "pink" : "mint")
                                      }
                                    >
                                      {x.blocked ? "Бұғатталған" : "Белсенді"}
                                    </span>
                                  </td>
                                  <td>
                                    {x.id !== u.id && (
                                      <div className="row-actions">
                                        <button
                                          className="text-link"
                                          onClick={() => {
                                            if (
                                              confirm(
                                                "Жаңа уақытша құпиясөз берілсін бе? Бұрынғы сеанстар аяқталады.",
                                              )
                                            )
                                              void act({
                                                action: "user-reset",
                                                id: x.id,
                                              }).catch(() => {});
                                          }}
                                        >
                                          <KeyRound size={16} />
                                          Қалпына келтіру
                                        </button>
                                        <button
                                          className="icon-btn"
                                          aria-label={
                                            x.blocked ? "Іске қосу" : "Бұғаттау"
                                          }
                                          onClick={() => {
                                            if (
                                              confirm(
                                                x.blocked
                                                  ? "Аккаунтты іске қосу керек пе?"
                                                  : "Аккаунтты бұғаттау керек пе?",
                                              )
                                            )
                                              void act({
                                                action: "user-update",
                                                id: x.id,
                                                blocked: !x.blocked,
                                              }).catch(() => {});
                                          }}
                                        >
                                          {x.blocked ? (
                                            <CheckCircle2 size={18} />
                                          ) : (
                                            <LockKeyhole size={18} />
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
                {view === "classes" && (
                  <>
                    <PageHead
                      title="Сыныптар"
                      text="Әр сыныптың қызығушылықтары мен алға басуын бақылаңыз."
                      action={
                        u.role === "specialist" ? (
                          <Btn icon={Plus} onClick={() => openClass()}>
                            Сынып қосу
                          </Btn>
                        ) : undefined
                      }
                    />
                    <div className="career-grid">
                      {state.classes.map((c) => {
                        const pupils = students.filter(
                          (s) => s.classId === c.id,
                        );
                        const done = pupils.filter((s) =>
                          completed.some((a) => a.owner === s.id),
                        ).length;
                        return (
                          <section className="card" key={c.id}>
                            <div className="section-heading">
                              <span className="stat-icon purple">
                                <GraduationCap />
                              </span>
                              <span className="tag neutral">
                                {pupils.length} оқушы
                              </span>
                            </div>
                            <h2>{c.name}</h2>
                            <p>
                              {state.users.find((s) => s.id === c.teacherId)
                                ?.name || "Сынып жетекшісі тағайындалмаған"}
                            </p>
                            <div className="progress">
                              <span
                                style={{
                                  width: `${pupils.length ? (done / pupils.length) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <p className="muted">
                              Тест аяқталды: {done} / {pupils.length}
                            </p>
                            {u.role === "specialist" && (
                              <button
                                className="text-link"
                                onClick={() => openClass(c)}
                              >
                                Баптау
                                <ArrowRight size={16} />
                              </button>
                            )}
                            <details>
                              <summary>Оқушылар тізімі</summary>
                              {pupils.map((s) => (
                                <div className="student-line" key={s.id}>
                                  <span>{s.name}</span>
                                  {u.role === "specialist" && (
                                    <select
                                      aria-label={s.name + " сыныбы"}
                                      value={s.classId || ""}
                                      onChange={(e) =>
                                        void act({
                                          action: "user-update",
                                          id: s.id,
                                          classId: e.target.value,
                                        }).catch(() => {})
                                      }
                                    >
                                      {state.classes.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ))}
                            </details>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
                {view === "assignments" && (
                  <>
                    <PageHead
                      title="Тест тағайындау"
                      text="Жаңа тест тағайындаңыз немесе қайта тапсыруға рұқсат беріңіз."
                      action={
                        <Btn icon={Plus} onClick={openAssignment}>
                          Тест тағайындау
                        </Btn>
                      }
                    />
                    {state.assignments.map((a) => (
                      <section className="card assignment-card" key={a.id}>
                        <div>
                          <span className="tag purple">36 сұрақ</span>
                          <h2>{a.title}</h2>
                          <p>
                            {a.recipients.length} оқушы ·{" "}
                            {a.closesAt
                              ? "Мерзімі: " + date(a.closesAt)
                              : "Мерзім шектеусіз"}{" "}
                            · {a.maxAttempts} мүмкіндік
                          </p>
                        </div>
                        <div>
                          <b>
                            {
                              new Set(
                                completed
                                  .filter((x) => x.assignmentId === a.id)
                                  .map((x) => x.owner),
                              ).size
                            }{" "}
                            / {a.recipients.length} аяқталды
                          </b>
                          <button
                            className="text-link"
                            onClick={() => {
                              const reason = prompt(
                                "Қайта тапсыруға рұқсат беру себебі (осы тағайындаудың барлық алушысына):",
                              );
                              if (reason)
                                void act({
                                  action: "retry",
                                  id: a.id,
                                  reason,
                                }).catch(() => {});
                            }}
                          >
                            <RefreshCw size={15} />
                            Қайта тапсыруға рұқсат
                          </button>
                        </div>
                      </section>
                    ))}
                  </>
                )}
                {view === "questions" && (
                  <>
                    <PageHead
                      title="Сұрақтар банкі"
                      text={`${state.questions.length} авторлық сұрақ. Әдістеме сараптамадан өтуі керек.`}
                      action={
                        <Btn icon={Plus} onClick={() => openQuestion()}>
                          Сұрақ қосу
                        </Btn>
                      }
                    />
                    {tools("Сұрақ іздеу…", Object.values(labels))}
                    <div className="card table-card">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Сұрақ</th>
                              <th>Шкала</th>
                              <th>Мәртебе</th>
                              <th>Әрекет</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.questions
                              .filter(
                                (q) =>
                                  q.text
                                    .toLowerCase()
                                    .includes(search.toLowerCase()) &&
                                  (!filter || labels[q.scale] === filter),
                              )
                              .slice(0, 100)
                              .map((q) => (
                                <tr key={q.id}>
                                  <td>
                                    {q.text}
                                    <small>
                                      {q.org ? "Ұйым сұрағы" : "Ортақ банк"} ·{" "}
                                      {q.version}-нұсқа
                                    </small>
                                  </td>
                                  <td>{labels[q.scale]}</td>
                                  <td>
                                    <span
                                      className={
                                        "tag " + (q.active ? "mint" : "neutral")
                                      }
                                    >
                                      {q.active ? "Белсенді" : "Өшірілген"}
                                    </span>
                                  </td>
                                  <td>
                                    {q.org === u.org ||
                                    u.role === "superadmin" ? (
                                      <button
                                        className="text-link"
                                        onClick={() => openQuestion(q)}
                                      >
                                        Өзгерту
                                      </button>
                                    ) : (
                                      <button
                                        className="text-link"
                                        onClick={() =>
                                          openQuestion({
                                            ...q,
                                            id: "",
                                            org: u.org,
                                          })
                                        }
                                      >
                                        Көшіріп қосу
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="table-note">
                        Алғашқы 100 сәйкес сұрақ көрсетілген. Қажеттісін іздеу
                        немесе сүзгі арқылы табыңыз.
                      </p>
                    </div>
                  </>
                )}
                {view === "organizations" && (
                  <>
                    <PageHead
                      title="Ұйымдар"
                      text="Жазылымдар, оқушы лимиттері және ұйымдар."
                      action={
                        <Btn icon={Plus} onClick={() => openOrg()}>
                          Ұйым қосу
                        </Btn>
                      }
                    />
                    <div className="career-grid">
                      {state.organizations.map((o) => (
                        <section className="card" key={o.id}>
                          <span className="stat-icon purple">
                            <Building2 />
                          </span>
                          <h2>{o.name}</h2>
                          <p>{o.city}</p>
                          <span
                            className={
                              "tag " + (o.status === "active" ? "mint" : "pink")
                            }
                          >
                            {o.status === "active"
                              ? "Белсенді"
                              : o.status === "suspended"
                                ? "Тоқтатылған"
                                : "Мұрағатта"}
                          </span>
                          <p>
                            Оқушылар лимиті: <b>{o.limit}</b>
                          </p>
                          <button
                            className="text-link"
                            onClick={() => openOrg(o)}
                          >
                            Баптау
                            <ArrowUpRight size={15} />
                          </button>
                        </section>
                      ))}
                    </div>
                  </>
                )}
                {view === "analytics" && (
                  <>
                    <PageHead
                      title="Қызығушылықтар көрінісі"
                      text="Бұл рейтинг емес. Көрсеткіштер оқушылармен әңгіме бастауға көмектеседі."
                      action={
                        <a
                          className="btn secondary"
                          href="/api/export"
                          download
                        >
                          <Download size={17} />
                          Excel жүктеу
                        </a>
                      }
                    />
                    <Analytics state={state} />
                  </>
                )}
                {view === "import" && (
                  <>
                    <PageHead
                      title="Оқушыларды импорттау"
                      text="Алдымен файлды тексеріп, содан кейін аккаунттарды жасаңыз."
                    />
                    <ImportPanel
                      state={state}
                      onImport={async (rows, key) => {
                        await act({ action: "import", rows, key });
                      }}
                    />
                  </>
                )}
                {view === "settings" && (
                  <>
                    <PageHead
                      title="Баптаулар"
                      text="Өзіңе ыңғайлы әрі қауіпсіз кеңістік."
                    />
                    <div className="settings-grid">
                      <section className="card">
                        <h2>Көрініс</h2>
                        <p>Жарық немесе күңгірт тақырыпты таңдаңыз.</p>
                        <div className="theme-options">
                          {[
                            ["system", "Жүйе бойынша"],
                            ["light", "Күндізгі"],
                            ["dark", "Түнгі"],
                          ].map(([v, l]) => (
                            <button
                              className={
                                "chip " + (theme === v ? "selected" : "")
                              }
                              key={v}
                              onClick={() => setTheme(v)}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                        <hr />
                        <h2>Профиль</h2>
                        <p>
                          {u.name}
                          <br />
                          {roleNames[u.role]}
                          <br />
                          {u.login}
                        </p>
                        <span className="tag mint">
                          <ShieldCheck size={14} /> Жеке деректер қорғалған
                        </span>
                      </section>
                      <section className="card">
                        <h2>Құпиясөзді өзгерту</h2>
                        <p>
                          Кемінде 12 таңба. Ұзын құпия тіркес қолдануға болады.
                        </p>
                        <form
                          className="form-stack"
                          onSubmit={formAction("password")}
                        >
                          <Field label="Жаңа құпиясөз">
                            <input
                              type="password"
                              name="password"
                              required
                              minLength={12}
                              maxLength={128}
                              autoComplete="new-password"
                            />
                          </Field>
                          <Btn type="submit" disabled={busy}>
                            Өзгерту және қайта кіру
                          </Btn>
                        </form>
                      </section>
                    </div>
                    <section className="card">
                      <h2>Деректер туралы</h2>
                      <p>
                        Анкета мен тест жауаптары нәтижені есептеу үшін
                        қолданылады. Жеке нәтижеңді өзің, ұйым маманы және өз
                        сыныбыңның жетекшісі көре алады. Анкетадағы жеке сұрақты
                        тек өзің мен маман көреді. Деректі түзету немесе жою
                        үшін ұйымдағы жауапты маманға хабарлас.
                      </p>
                      <p className="muted">
                        Демо нұсқада тек ойдан шығарылған деректер қолданылады.
                        Нақты оқушылармен жұмыс басталмас бұрын келісім, сақтау
                        мерзімі және әдістеме сараптамасы бекітілуі керек.
                      </p>
                    </section>
                    {canManage && (
                      <section className="card">
                        <h2>Әрекеттер журналы</h2>
                        {state.audit.slice(0, 10).map((a) => (
                          <div className="audit-line" key={a.id}>
                            <span>{actionLabel(a.action)}</span>
                            <small>{date(a.createdAt)}</small>
                          </div>
                        ))}
                      </section>
                    )}
                  </>
                )}
              </motion.div>
            )}
            <footer className="footer">
              <Logo />
              <span>Өз болашағыңның бағытын өзің таңда.</span>
              <span>© {new Date().getFullYear()} Bagdar</span>
            </footer>
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={20} />
            {toast}
          </div>
        )}
        {modal}
        {modal && error && (
          <div className="toast error-toast" role="alert">
            <AlertCircle size={19} />
            <span>{error}</span>
            <button
              className="icon-btn"
              aria-label="Қате хабарын жабу"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {career && (
          <Modal title={career.name} wide onClose={() => setCareer(null)}>
            <div className="career-detail">
              <span className="tag purple">{career.sector}</span>
              <p className="lead">{career.description}</p>
              <h3>Күнделікті міндеттері</h3>
              <p>{career.task}</p>
              <div className="settings-grid">
                <div>
                  <h3>Қажетті дағдылар</h3>
                  <ul>
                    {career.skills.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Пайдалы пәндер</h3>
                  <ul>
                    {career.subjects.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <h3>Білім алу жолы</h3>
              <p>{career.route}</p>
              <div className="notice">
                Нақты оқу бағдарламалары мен қабылдау шарттарын оқу орнының
                ресми сайтынан тексер. Мұнда балл немесе грантқа кепілдік
                берілмейді.
              </div>
              <h3>Байқап көруге арналған қадам</h3>
              <p>
                Осы жұмыстағы бір міндетті таңдап, шағын оқу жобасын дайында. Не
                ұнағанын және нені үйренгің келетінін жазып көр.
              </p>
            </div>
          </Modal>
        )}
        {credentials && (
          <Modal
            title="Кіру деректерін сақтап алыңыз"
            onClose={() => setCredentials(null)}
          >
            <div className="notice warning">
              Құпиясөздер тек осы жолы көрсетіледі. Қайта көру мүмкін емес —
              қажет болса, жаңа құпиясөз жасалады.
            </div>
            <div className="credentials">
              {credentials.map((c) => (
                <div key={c.login}>
                  <b>{c.login}</b>
                  <code>{c.password}</code>
                </div>
              ))}
            </div>
            <Btn icon={Printer} onClick={() => window.print()}>
              Басып шығару
            </Btn>
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}
function PageHead({
  title,
  text,
  eyebrow,
  action,
}: {
  title: string;
  text: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function attendanceLabel(v: string | undefined) {
  return (
    (
      {
        present: "Қатысты",
        absent: "Қатыспады",
        excused: "Себепті",
        unknown: "Белгіленбеген",
      } as Record<string, string>
    )[v || "unknown"] || "Белгіленбеген"
  );
}
function actionLabel(v: string) {
  return (
    (
      {
        start: "Тест басталды",
        finish: "Тест аяқталды",
        comment: "Пікір қосылды",
        "user-create": "Аккаунт жасалды",
        "user-update": "Аккаунт өзгертілді",
        "user-reset": "Құпиясөз қалпына келтірілді",
        class: "Сынып сақталды",
        assign: "Тест тағайындалды",
        retry: "Қайта тапсыру рұқсаты",
        training: "Тренинг жарияланды",
        attendance: "Қатысу белгіленді",
        question: "Сұрақ сақталды",
        career: "Мамандық сақталды",
        organization: "Ұйым сақталды",
        import: "Импорт орындалды",
      } as Record<string, string>
    )[v] || "Әкімшілік әрекет"
  );
}
function Login({
  onLogin,
  error,
  busy,
  demoAllowed = true,
}: {
  onLogin: (body: Record<string, unknown>) => Promise<void>;
  error: string;
  busy: boolean;
  demoAllowed?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="login-page">
      <section className="login-story">
        <Logo />
        <div className="login-story-copy">
          <span className="hero-kicker">
            <Sparkles size={16} /> МҮМКІНДІКТЕР ОСЫ ЖЕРДЕН БАСТАЛАДЫ
          </span>
          <h1>
            Болашағыңа
            <br />
            бағыт <span>бер.</span>
          </h1>
          <p>
            Сенің қызығушылықтарың. Сенің армандарың.
            <br />
            Өзіңе жақын мамандықты бірге табайық.
          </p>
          <div className="login-illustration" aria-hidden="true">
            <span className="login-star">✦</span>
            <div className="login-orbit" />
            <div className="login-compass">
              <Compass strokeWidth={0.8} />
            </div>
            <span className="login-float">
              <Lightbulb size={20} /> Өз мүмкіндігіңді аш
            </span>
          </div>
          <div className="login-promises">
            <span>
              <CheckCircle2 size={17} /> Өзіңді таны
            </span>
            <span>
              <CheckCircle2 size={17} /> Бағытыңды тап
            </span>
            <span>
              <CheckCircle2 size={17} /> Алғашқы қадам жаса
            </span>
          </div>
        </div>
        <div className="login-bottom">
          Әр адамның өз жолы бар. Өзіңдікін табуға көмектесеміз.
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-mobile-logo">
          <Logo />
        </div>
        <div className="login-form">
          <span className="small-icon">
            <ArrowUpRight size={26} />
          </span>
          <h2>Қош келдің!</h2>
          <p className="lead">Өзіңді тануға бір қадам жақынсың.</p>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              void onLogin(f);
            }}
          >
            <Field label="Логин">
              <input
                name="login"
                placeholder="Логиніңді енгіз"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Құпиясөз">
              <span className="password-input">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  placeholder="Құпиясөзіңді енгіз"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={show ? "Құпиясөзді жасыру" : "Құпиясөзді көрсету"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </Field>
            <p className="login-help">
              Құпиясөзді ұмыттың ба? Мектептегі жауапты маманға хабарлас.
            </p>
            {error && (
              <div role="alert" className="notice error">
                {error}
              </div>
            )}
            <Btn type="submit" disabled={busy}>
              Кіру
              <ArrowRight size={19} />
            </Btn>
          </form>
          <p className="login-register">
            <LockKeyhole size={14} /> Аккаунтты мектептің жауапты маманы береді.
          </p>
          {demoAllowed && (
            <div className="demo-login">
              <div className="demo-login-title">
                <span>АЛДЫМЕН БАЙҚАП КӨР</span>
                <span className="tag purple">Демо</span>
              </div>
              <p>Рөлді таңдап, платформамен таныс.</p>
              <div className="demo-roles">
                {[
                  ["student05", "Оқушы", GraduationCap],
                  ["teacher.9a", "Сынып жетекшісі", Users],
                  ["prof.demo", "Маман", BriefcaseBusiness],
                ].map(([login, label, Icon]) => {
                  const I = Icon as LucideIcon;
                  return (
                    <button
                      key={String(login)}
                      disabled={busy}
                      onClick={() => void onLogin({ login, demo: true })}
                    >
                      <I size={19} />
                      <span>{String(label)}</span>
                      <ArrowUpRight size={15} />
                    </button>
                  );
                })}
              </div>
              <small>
                Тек синтетикалық деректер. Нақты оқушы ақпараты жоқ.
              </small>
            </div>
          )}
          <div className="login-security">
            <ShieldCheck size={16} /> Сенің деректерің қауіпсіз кеңістікте
          </div>
        </div>
      </section>
    </div>
  );
}
function SurveyEditor({
  state,
  busy,
  onSave,
}: {
  state: State;
  busy: boolean;
  onSave: (
    a: Record<string, string | string[]>,
    c: boolean,
    consent: boolean,
  ) => Promise<void>;
}) {
  const existing = state.surveys.find((s) => s.owner === state.user.id);
  const [values, setValues] = useState<Record<string, string | string[]>>(
      existing?.answers || {},
    ),
    [consent, setConsent] = useState(existing?.complete || false),
    [status, setStatus] = useState(""),
    [pending, setPending] = useState(false);
  const lastSaved = useRef(JSON.stringify(existing?.answers || {}));
  useEffect(() => {
    const serialized = JSON.stringify(values);
    if (serialized === lastSaved.current) return;
    setStatus("Сақталуда…");
    const timer = setTimeout(async () => {
      try {
        await request("action", {
          action: "survey",
          answers: values,
          complete: false,
        });
        lastSaved.current = serialized;
        setStatus("Сақталды");
      } catch {
        setStatus("Сақталмады. Сақтау түймесін басып көр.");
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [values]);
  return (
    <form
      className="card survey-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await onSave(values, true, consent);
        } catch {
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="section-heading">
        <span className="tag purple">12 қысқа сұрақ</span>
        <span className="save-status" role="status">
          {status}
        </span>
      </div>
      <div className="survey-grid">
        {surveyFields.map((f, i) => (
          <Field
            key={f.id}
            label={`${String(i + 1).padStart(2, "0")}. ${f.label}`}
          >
            {f.type === "select" ? (
              <select
                value={String(values[f.id] || "")}
                onChange={(e) =>
                  setValues({ ...values, [f.id]: e.target.value })
                }
              >
                <option value="">Таңдау міндетті емес</option>
                {f.options?.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={String(values[f.id] || "")}
                  onChange={(e) =>
                    setValues({ ...values, [f.id]: e.target.value })
                  }
                  placeholder="Ойыңмен бөліс немесе бос қалдыр"
                />
                {f.id === "private" && (
                  <small className="muted">
                    Жауабыңды тек өзің және кәсіби бағдар маманы көреді.
                  </small>
                )}
              </>
            )}
          </Field>
        ))}
      </div>
      <label className="consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        <span>
          Деректердің не үшін жиналатынын және кім көре алатынын түсіндім. Бұл
          демода тек ойдан шығарылған жауаптарды қолданамын.
        </span>
      </label>
      <div className="form-actions">
        <Btn
          secondary
          disabled={busy || pending}
          onClick={() => {
            setPending(true);
            void onSave(values, false, consent)
              .finally(() => setPending(false))
              .catch(() => {});
          }}
        >
          Жобаны сақтау
        </Btn>
        <Btn type="submit" disabled={busy || pending || !consent}>
          Сақтау және тестке өту
          <ArrowRight size={17} />
        </Btn>
      </div>
    </form>
  );
}
function TestArea({
  state,
  act,
  busy,
  onSurvey,
  onResult,
}: {
  state: State;
  act: (
    b: Record<string, unknown>,
    s?: string,
  ) => Promise<Record<string, unknown>>;
  busy: boolean;
  onSurvey: () => void;
  onResult: (id: string) => void;
}) {
  const own = state.attempts.filter((a) => a.owner === state.user.id);
  const active = own.find((a) => a.status === "active");
  const [index, setIndex] = useState(() =>
      active
        ? Math.max(
            0,
            active.questions.findIndex((q) => !active.answers[q.id]),
          )
        : 0,
    ),
    [saving, setSaving] = useState(false),
    [choice, setChoice] = useState<{ qid: string; value: number } | null>(null),
    [saveErrorId, setSaveErrorId] = useState<string | null>(null);
  const timing = useRef({ start: 0, total: 0 });
  const heading = useRef<HTMLHeadingElement>(null);
  const question = active?.questions[index];
  const chosen =
    choice?.qid === question?.id
      ? choice?.value
      : question && active
        ? active.answers[question.id]
        : null;
  const saveError = saveErrorId === question?.id;
  useEffect(() => {
    timing.current = {
      start: document.hidden ? 0 : performance.now(),
      total: 0,
    };
    heading.current?.focus();
    const handle = () => {
      if (document.hidden && timing.current.start) {
        timing.current.total += performance.now() - timing.current.start;
        timing.current.start = 0;
      } else if (!document.hidden) timing.current.start = performance.now();
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [question?.id, active?.id]);
  async function answer(value: number) {
    if (!active || !question || saving) return;
    setChoice({ qid: question.id, value });
    setSaving(true);
    setSaveErrorId(null);
    const elapsed = Math.max(
      0,
      timing.current.total +
        (timing.current.start ? performance.now() - timing.current.start : 0),
    );
    try {
      await act(
        {
          action: "answer",
          attemptId: active.id,
          questionId: question.id,
          value,
          version: active.version,
          elapsed,
        },
        "",
      );
      timing.current = { start: performance.now(), total: 0 };
    } catch {
      setSaveErrorId(question.id);
    } finally {
      setSaving(false);
    }
  }
  if (!state.surveys.find((s) => s.owner === state.user.id)?.complete)
    return (
      <section className="card test-intro">
        <div className="intro-icon">
          <ClipboardList size={36} />
        </div>
        <h2>Алдымен өзің туралы айтып бер</h2>
        <p>Қысқа сауалнама ұсыныстарды өзіңе жақын етуге көмектеседі.</p>
        <Btn onClick={onSurvey}>
          Сауалнаманы толтыру
          <ArrowRight size={17} />
        </Btn>
      </section>
    );
  if (!active)
    return (
      <div className="assignment-grid">
        {state.assignments
          .filter((a) => a.recipients.includes(state.user.id))
          .map((a) => {
            const attempts = own.filter((x) => x.assignmentId === a.id);
            const last = attempts
              .filter((a) => a.status === "completed")
              .at(-1);
            const canStart =
              attempts.length < a.maxAttempts &&
              (!a.closesAt || new Date(a.closesAt) > new Date());
            return (
              <section className="card test-intro" key={a.id}>
                <span className="intro-icon">
                  <Compass size={38} />
                </span>
                <span className="tag purple">36 сұрақ · 3 бағыт</span>
                <h2>{a.title}</h2>
                <p>
                  Өзіңді басқалармен салыстырма. Әр жауап — сені тануға
                  көмектесетін белгі.
                </p>
                <div className="test-facts">
                  <span>
                    <Check size={15} />
                    Баға қойылмайды
                  </span>
                  <span>
                    <Clock size={15} />
                    Кейін жалғастыруға болады
                  </span>
                </div>
                {canStart ? (
                  <Btn
                    disabled={busy}
                    onClick={() =>
                      void act(
                        { action: "start", assignmentId: a.id },
                        "Тест дайын",
                      ).catch(() => {})
                    }
                  >
                    Тестті бастау
                    <ArrowRight size={17} />
                  </Btn>
                ) : last ? (
                  <Btn secondary onClick={() => onResult(last.id)}>
                    Нәтижені көру
                    <ArrowUpRight size={17} />
                  </Btn>
                ) : (
                  <span className="tag neutral">Тест мерзімі аяқталды</span>
                )}
                {last && !canStart && (
                  <small>Қайта тапсыру үшін жауапты маманға хабарлас.</small>
                )}
              </section>
            );
          })}
        {!state.assignments.length && (
          <Empty
            title="Тест әлі тағайындалмаған"
            text="Жауапты маман тест тағайындағанда, осы жерде көрінеді."
          />
        )}
      </div>
    );
  if (!question) return <Empty />;
  const answered = Object.keys(active.answers).length;
  return (
    <section className="test-card">
      <div className="test-top">
        <span className="tag purple">
          <Compass size={14} /> Өзіңді зертте
        </span>
        <span>
          {index + 1} <span className="muted">/ 36</span>
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${(answered / 36) * 100}%` }} />
      </div>
      <div className="test-question">
        <span className="eyebrow">ӨЗІҢЕ ҚАНШАЛЫҚТЫ ЖАҚЫН?</span>
        <h2 ref={heading} tabIndex={-1}>
          {question.text}
        </h2>
        <p>Өзіңе ең жақын бір жауапты таңда.</p>
      </div>
      <div className="answer-options" role="group" aria-label="Жауаптар">
        {answers.map((text, i) => (
          <button
            key={text}
            className={"answer-option " + (chosen === i + 1 ? "selected" : "")}
            disabled={saving || busy}
            aria-pressed={chosen === i + 1}
            onClick={() => void answer(i + 1)}
          >
            <span className="answer-number">{i + 1}</span>
            <span>{text}</span>
            <span className="answer-radio">
              {chosen === i + 1 && <Check size={14} />}
            </span>
          </button>
        ))}
      </div>
      <div className="test-navigation">
        <Btn
          secondary
          disabled={index === 0 || saving || busy}
          onClick={() => setIndex(index - 1)}
        >
          <ArrowLeft size={16} />
          Артқа
        </Btn>
        <span
          className={"save-status " + (saveError ? "error-text" : "")}
          role="status"
        >
          {saving
            ? "Сақталуда…"
            : saveError
              ? "Сақталмады. Жауапты қайта бас."
              : chosen
                ? "Сақталды"
                : "Жауабыңды таңда"}
        </span>
        {index < 35 ? (
          <Btn
            disabled={
              !active.answers[question.id] || saving || busy || saveError
            }
            onClick={() => setIndex(index + 1)}
          >
            Келесі
            <ArrowRight size={16} />
          </Btn>
        ) : (
          <Btn
            disabled={answered !== 36 || saving || busy || saveError}
            onClick={() => {
              if (
                confirm(
                  "Барлық жауапты тексердің бе? Аяқтағаннан кейін өзгерту мүмкін емес.",
                )
              )
                void act(
                  { action: "finish", attemptId: active.id },
                  "Нәтижең дайын!",
                )
                  .then(() => onResult(active.id))
                  .catch(() => {});
            }}
          >
            Тестті аяқтау
            <Check size={16} />
          </Btn>
        )}
      </div>
      <div className="question-jumps" aria-label="Сұраққа өту">
        {active.questions.map((q, i) => (
          <button
            aria-label={`${i + 1}-сұрақ`}
            className={
              (active.answers[q.id] ? "answered " : "") +
              (index === i ? "current" : "")
            }
            key={q.id}
            disabled={saving || busy}
            onClick={() => setIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
function Chart({
  scores,
  family,
}: {
  scores: Record<string, number>;
  family: "riasec" | "klimov";
}) {
  const data = scales[family].map((key) => ({
    name: labels[key],
    value: Math.round(scores[key]),
    max: 100,
  }));
  return (
    <>
      <div className="radar-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} outerRadius="65%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--muted)" }}
            />
            <Radar
              name="Қызығушылықтар"
              dataKey="max"
              stroke="transparent"
              fill="transparent"
            />
            <Radar
              name="Сенің жауаптарың"
              dataKey="value"
              stroke="#6C3BFF"
              fill="#6C3BFF"
              fillOpacity={0.2}
              strokeWidth={2.5}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-details">
        <summary>Сандармен көру</summary>
        <dl>
          {data.map((d) => (
            <div key={d.name}>
              <dt>{d.name}</dt>
              <dd>{d.value} / 100</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}
function ResultView({
  attempt,
  state,
  onCareer,
}: {
  attempt: Attempt;
  state: State;
  onCareer: (id: string) => void;
}) {
  const r = attempt.result!;
  const interests = scales.riasec
    .map((k) => ({ key: k, score: r.scores[k] }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const flat = interests[0].score - interests.at(-1)!.score < 10;
  const name = state.users.find((s) => s.id === attempt.owner)?.name;
  return (
    <>
      <section className="result-hero">
        <div className="result-star">✦</div>
        <div>
          <span className="eyebrow">
            {name} · {date(r.completedAt)}
          </span>
          <h2>
            {flat
              ? "Қызығушылықтарың әртүрлі бағытта"
              : `${labels[interests[0].key]} және ${labels[interests[1].key].toLowerCase()} бағыт`}
          </h2>
          <p>
            Сенің бағытың — өз қолыңда. Әртүрлі мүмкіндікті байқап көруден
            қорықпа.
          </p>
        </div>
      </section>
      {r.flags.some((f) => f !== "timing_unavailable") && (
        <div className="notice warning">
          Нәтижені маманмен талқылап, тестті қайта тапсырып көру ұсынылады. Бұл
          ескерту нәтижеңді жоққа шығармайды.
        </div>
      )}
      <div className="settings-grid">
        <section className="card">
          <h2>Қызығушылықтар бейнең</h2>
          <p>Саған жақын әрекет бағыттары</p>
          <Chart scores={r.scores} family="riasec" />
        </section>
        <section className="card">
          <h2>Кәсіби бағыттар</h2>
          <p>Қандай ортадағы жұмыс қызығырақ?</p>
          <Chart scores={r.scores} family="klimov" />
        </section>
      </div>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Дағдыларыңды қалай бағалайсың?</h2>
            <p>Бұл өлшеу емес, қазіргі өз ойың. Дағдыларды дамытуға болады.</p>
          </div>
          <span className="tag mint">Өсуге мүмкіндік бар</span>
        </div>
        <div className="skills-grid">
          {scales.skills.map((k) => (
            <div key={k}>
              <div className="skill-title">
                <b>{labels[k]}</b>
                <span>
                  {r.scores[k] >= 70
                    ? "Жоғары"
                    : r.scores[k] >= 40
                      ? "Орташа"
                      : "Дамып келеді"}
                </span>
              </div>
              <div className="progress">
                <span style={{ width: r.scores[k] + "%" }} />
              </div>
              <small>{Math.round(r.scores[k])} / 100</small>
            </div>
          ))}
        </div>
      </section>
      <div className="section-heading outside">
        <div>
          <h2>Саған сәйкес келуі мүмкін 5 мамандық</h2>
          <p>
            Көрсеткіш — жауаптардың ұқсастығы. Ол табысқа кепілдік бермейді.
          </p>
        </div>
      </div>
      <div className="recommendation-list">
        {r.top.map((c, i) => (
          <section className="card recommendation" key={c.id}>
            <span className="recommendation-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className="mini-label">ЗЕРТТЕП КӨРУГЕ ТҰРАРЛЫҚ</span>
              <h3>{c.name}</h3>
              {c.reasons.map((reason, n) => (
                <p key={n}>{reason}</p>
              ))}
              <button className="text-link" onClick={() => onCareer(c.id)}>
                Мамандықты зерттеу
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="match-index">
              <strong>
                {Math.round(c.index)}
                <small>/100</small>
              </strong>
              <span>Сәйкестік көрсеткіші</span>
            </div>
          </section>
        ))}
      </div>
      <section className="next-steps">
        <Lightbulb size={32} />
        <div>
          <h2>Келесі қадам — байқап көру</h2>
          <p>
            Бір мамандықты таңда, шағын жоба жасап көр, содан кейін әсеріңді
            жаз. Нәтижеңді маманмен талқылауға болады.
          </p>
        </div>
      </section>
      <p className="disclaimer">
        Бұл нәтиже — өзіңді тануға арналған бағдар. Ол диагноз емес және болашақ
        мамандығыңды біржола анықтамайды. Авторлық сауалнама әдістемелік
        тексеруді қажет етеді.
      </p>
    </>
  );
}
function Analytics({ state }: { state: State }) {
  const [assignment, setAssignment] = useState(state.assignments[0]?.id || ""),
    [classId, setClassId] = useState("");
  const a = state.assignments.find((a) => a.id === assignment);
  const pupils = state.users.filter(
    (u) =>
      u.role === "student" &&
      (!classId || u.classId === classId) &&
      (!a || a.recipients.includes(u.id)),
  );
  const latest = pupils
    .map(
      (u) =>
        state.attempts
          .filter(
            (x) =>
              x.owner === u.id &&
              x.status === "completed" &&
              (!a || x.assignmentId === a.id),
          )
          .sort((a, b) =>
            (b.completedAt || "").localeCompare(a.completedAt || ""),
          )[0],
    )
    .filter(Boolean);
  const count = latest.length;
  const scores = Object.fromEntries(
    Object.keys(labels).map((k) => [
      k,
      count
        ? latest.reduce((s, a) => s + (a.result?.scores[k] || 0), 0) / count
        : 0,
    ]),
  );
  return (
    <>
      <div className="toolbar">
        <select
          aria-label="Тест тағайындауы"
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
        >
          <option value="">Барлық тағайындаулар</option>
          {state.assignments.map((a) => (
            <option value={a.id} key={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Сынып бойынша сүзгі"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">Барлық сыныптар</option>
          {state.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="stats-grid three">
        <section className="card">
          <span className="muted">Алушылар</span>
          <h2>{pupils.length}</h2>
        </section>
        <section className="card">
          <span className="muted">Аяқталды</span>
          <h2>
            {count} / {pupils.length}
          </h2>
        </section>
        <section className="card">
          <span className="muted">Әлі аяқталмаған</span>
          <h2>{pupils.length - count}</h2>
        </section>
      </div>
      {count >= 5 ? (
        <div className="settings-grid">
          <section className="card">
            <h2>Қызығушылықтардың орташа көрінісі</h2>
            <Chart scores={scores} family="riasec" />
          </section>
          <section className="card">
            <h2>Кәсіби бағыттар</h2>
            <Chart scores={scores} family="klimov" />
          </section>
        </div>
      ) : (
        <section className="card">
          <Empty
            title="Топта дерек жеткіліксіз"
            text="Құпиялылық үшін таралымдар кемінде 5 аяқталған нәтиже болғанда көрсетіледі."
            icon={ShieldCheck}
          />
        </section>
      )}
      <section className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Оқушы</th>
                <th>Сынып</th>
                <th>Тест мәртебесі</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>
                    {state.classes.find((c) => c.id === u.classId)?.name || "—"}
                  </td>
                  <td>
                    <span
                      className={
                        "tag " +
                        (latest.some((a) => a.owner === u.id)
                          ? "mint"
                          : "neutral")
                      }
                    >
                      {latest.some((a) => a.owner === u.id)
                        ? "Аяқталды"
                        : state.attempts.some(
                              (x) =>
                                x.owner === u.id &&
                                x.status === "active" &&
                                (!a || x.assignmentId === a.id),
                            )
                          ? "Орындалуда"
                          : a?.closesAt && new Date(a.closesAt) < new Date()
                            ? "Мерзімі өтті"
                            : "Басталмады"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function QuestionForm({
  question: q,
  busy,
  onSave,
}: {
  question?: Question;
  busy: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [family, setFamily] = useState<Question["family"]>(
      q?.family || "riasec",
    ),
    [err, setErr] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        try {
          await onSave({
            ...f,
            active: f.active === "true",
            reverse: f.reverse === "on",
          });
        } catch (e) {
          setErr((e as Error).message);
        }
      }}
    >
      <Field label="Сұрақ мәтіні">
        <textarea
          name="text"
          required
          minLength={8}
          defaultValue={q?.text}
          rows={4}
        />
      </Field>
      <Field label="Бағыт">
        <select
          name="family"
          value={family}
          onChange={(e) => setFamily(e.target.value as Question["family"])}
        >
          <option value="riasec">Қызығушылықтар</option>
          <option value="klimov">Кәсіби бағыттар</option>
          <option value="skills">Дағдыларды өзіндік бағалау</option>
        </select>
      </Field>
      <Field label="Шкала">
        <select key={family} name="scale" defaultValue={q?.scale}>
          {scales[family].map((k) => (
            <option key={k} value={k}>
              {labels[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Мәртебе">
        <select
          name="active"
          defaultValue={q?.active === false ? "false" : "true"}
        >
          <option value="true">Белсенді</option>
          <option value="false">Өшірілген</option>
        </select>
      </Field>
      <label className="consent">
        <input type="checkbox" name="reverse" defaultChecked={q?.reverse} />
        Кері кодтау
      </label>
      {err && (
        <p className="error-text" role="alert">
          {err}
        </p>
      )}
      <Btn type="submit" disabled={busy}>
        Сақтау
      </Btn>
    </form>
  );
}
function CareerForm({
  career: c,
  busy,
  onSave,
}: {
  career?: Career;
  busy: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [err, setErr] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        const targets = Object.fromEntries(
          Object.keys(labels).map((k) => [k, Number(f["target-" + k])]),
        );
        try {
          await onSave({
            ...f,
            targets,
            skills: String(f.skills)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            subjects: String(f.subjects)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            tags: String(f.tags)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            active: f.active === "true",
          });
        } catch (e) {
          setErr((e as Error).message);
        }
      }}
    >
      <Field label="Мамандық атауы">
        <input name="name" required defaultValue={c?.name} />
      </Field>
      <Field label="Сипаттамасы">
        <textarea
          name="description"
          minLength={10}
          required
          defaultValue={c?.description}
        />
      </Field>
      <Field label="Күнделікті міндеттері">
        <textarea name="task" minLength={10} required defaultValue={c?.task} />
      </Field>
      <div className="settings-grid">
        <Field label="Сала">
          <select name="sector" defaultValue={c?.sector}>
            {scales.klimov.map((k) => (
              <option key={k}>{labels[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Мәртебе">
          <select
            name="active"
            defaultValue={c?.active === false ? "false" : "true"}
          >
            <option value="true">Белсенді</option>
            <option value="false">Өшірілген</option>
          </select>
        </Field>
      </div>
      <Field label="Білім алу жолы">
        <input name="route" required defaultValue={c?.route} />
      </Field>
      <Field label="Дағдылар (үтір арқылы)">
        <input name="skills" required defaultValue={c?.skills.join(", ")} />
      </Field>
      <Field label="Пәндер (үтір арқылы)">
        <input name="subjects" required defaultValue={c?.subjects.join(", ")} />
      </Field>
      <Field label="Сәйкестік тегтері (міндетті емес)">
        <input name="tags" defaultValue={c?.tags.join(", ")} />
      </Field>
      <h3>Мамандықтың шкала профилі (0–100)</h3>
      <p className="muted">
        Бұл сараптамалық модель, жұмыс берушінің өлшенген талабы емес.
      </p>
      <div className="targets-grid">
        {Object.entries(labels).map(([k, l]) => (
          <Field key={k} label={l}>
            <input
              type="number"
              min={0}
              max={100}
              name={"target-" + k}
              required
              defaultValue={c?.targets[k] ?? 50}
            />
          </Field>
        ))}
      </div>
      {err && <p className="error-text">{err}</p>}
      <Btn type="submit" disabled={busy}>
        Сақтау
      </Btn>
    </form>
  );
}
function ImportPanel({
  state,
  onImport,
}: {
  state: State;
  onImport: (
    rows: { name: string; login: string; classId: string }[],
    key: string,
  ) => Promise<void>;
}) {
  const [preview, setPreview] = useState<{
      rows: {
        line: number;
        name: string;
        login: string;
        classId: string;
        errors: string[];
      }[];
      key: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function template() {
    const file = new Blob(
      [
        '\uFEFFАты,Тегі,Сынып,Логин,Рөлі\nҮлгі,Оқушы,"' +
          (state.classes[0]?.name.replaceAll('"', '""') || "9 «А»") +
          '",sample.student,Оқушы\n',
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const link = document.createElement("a");
    const url = URL.createObjectURL(file);
    link.href = url;
    link.download = "Bagdar-import.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="card">
      <div className="import-intro">
        <div className="intro-icon">
          <FileUp size={32} />
        </div>
        <h2>Тізімді бір файлмен жүкте</h2>
        <p>
          CSV немесе XLSX · 1000 жолға дейін · 5 МБ дейін.
          <br />
          Сыныптар алдын ала құрылуы керек. Бұл нұсқада тек оқушылар импорты
          бар.
        </p>
        <Btn secondary icon={Download} onClick={template}>
          Үлгіні жүктеу
        </Btn>
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/import-preview", {
              method: "POST",
              body: new FormData(e.currentTarget),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPreview(data);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Оқушылар файлы">
          <input type="file" accept=".csv,.xlsx" name="file" required />
        </Field>
        <Btn type="submit" disabled={busy}>
          Файлды тексеру
        </Btn>
      </form>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {preview && (
        <>
          <h3>Алдын ала тексеру: {preview.rows.length} жол</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Жол</th>
                  <th>Аты-жөні</th>
                  <th>Логин</th>
                  <th>Тексеру</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>{r.name}</td>
                    <td>{r.login}</td>
                    <td className={r.errors.length ? "error-text" : ""}>
                      {r.errors.join("; ") || "Дайын"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Btn
            disabled={
              busy ||
              !preview.rows.length ||
              preview.rows.some((r) => r.errors.length > 0)
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onImport(
                  preview.rows.map((r) => ({
                    name: r.name,
                    login: r.login,
                    classId: r.classId,
                  })),
                  preview.key,
                );
                setPreview(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Аккаунттарды жасау
          </Btn>
        </>
      )}
    </section>
  );
}
function TrainingExtras({
  training: t,
  state,
  onReload,
  onFeedback,
}: {
  training: State["trainings"][number];
  state: State;
  onReload: () => Promise<void>;
  onFeedback: (v: { rating: number; text: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mine = state.feedback.find(
    (f) => f.trainingId === t.id && f.owner === state.user.id,
  );
  return (
    <div className="training-extras">
      {state.materials
        .filter((m) => m.trainingId === t.id)
        .map((m) => (
          <a
            className="material-link"
            key={m.id}
            href={"/api/material?id=" + m.id}
            download
          >
            <Download size={15} />
            <span>{m.filename}</span>
            <small>{Math.max(1, Math.round(m.size / 1024))} КБ</small>
          </a>
        ))}
      {state.user.role === "specialist" && (
        <details>
          <summary>Материал жүктеу</summary>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const form = e.currentTarget;
              const data = new FormData(form);
              data.set("trainingId", t.id);
              try {
                const res = await fetch("/api/material", {
                  method: "POST",
                  body: data,
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error);
                await onReload();
                form.reset();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="PDF немесе сурет (20 МБ дейін)">
              <input
                type="file"
                name="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp"
              />
            </Field>
            <Btn type="submit" disabled={busy}>
              Жүктеу
            </Btn>
          </form>
        </details>
      )}
      {state.user.role === "student" &&
        new Date(t.date) < new Date() &&
        t.status !== "cancelled" && (
          <details>
            <summary>
              {mine
                ? "Кері байланысты өзгерту"
                : "Тренинг туралы ойыңмен бөліс"}
            </summary>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                setBusy(true);
                setError("");
                try {
                  await onFeedback({
                    rating: Number(f.rating),
                    text: String(f.text),
                  });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Тренинг қаншалықты пайдалы болды?">
                <select name="rating" defaultValue={mine?.rating || 3}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v} / 5
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Не ұнады, нені жақсартуға болады?">
                <textarea
                  name="text"
                  maxLength={1000}
                  defaultValue={mine?.text || ""}
                />
              </Field>
              <Btn type="submit" disabled={busy}>
                Пікірді сақтау
              </Btn>
            </form>
          </details>
        )}
      {state.user.role !== "student" && (
        <details>
          <summary>
            Кері байланыс (
            {state.feedback.filter((f) => f.trainingId === t.id).length})
          </summary>
          {state.feedback
            .filter((f) => f.trainingId === t.id)
            .map((f) => (
              <div key={f.id} className="comment">
                <b>{state.users.find((u) => u.id === f.owner)?.name}</b>
                <span className="tag purple">{f.rating} / 5</span>
                <p>{f.text === "—" ? "Мәтіндік пікір жоқ" : f.text}</p>
              </div>
            ))}
        </details>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
