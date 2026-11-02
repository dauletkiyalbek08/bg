export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}
export async function apiRequest(
  path: string,
  body?: unknown,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 20000);
  try {
    const response = await fetch("/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ApiError(
        "Серверден дұрыс жауап келмеді. Бетті жаңартып, қайта көріңіз.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ApiError(
        typeof data?.error === "string"
          ? data.error
          : "Сұрау орындалмады. Қайта көріңіз.",
        response.status,
      );
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new ApiError(
        "Серверден дұрыс жауап келмеді. Бетті жаңартып, қайта көріңіз.",
      );
    return data;
  } catch (error) {
    if (timedOut)
      throw new ApiError(
        "Серверден жауап күту уақыты аяқталды. Байланысты тексеріп, қайта көріңіз.",
      );
    if (options.signal?.aborted) throw new ApiError("Сұрау тоқтатылды.");
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Серверге қосылу мүмкін болмады. Байланысты тексеріп, қайта көріңіз.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
