export function mustGet<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing #${id}`);
  }
  return el as T;
}

export async function errorDetail(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }
    if (data && typeof data === "object" && "detail" in data) {
      return JSON.stringify(data.detail);
    }
    return "";
  } catch {
    return "";
  }
}
