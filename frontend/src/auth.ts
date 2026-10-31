const TOKEN_KEY = "token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace("/login");
}

export function requireAuth(): void {
  if (!getToken()) {
    window.location.replace("/login");
  }
}

export function redirectIfAuthed(): void {
  if (getToken()) {
    window.location.replace("/");
  }
}

export async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) logout();
  return res;
}

export function renderNav(): void {
  if (document.getElementById("navbar")) return;
  const bar = document.createElement("header");
  bar.id = "navbar";
  bar.innerHTML =
    '<a class="brand" href="/">' +
    '<span class="brand-mark" aria-hidden="true"></span>' +
    '<span class="brand-name">Cinabre</span>' +
    "</a>" +
    '<nav class="nav-actions">' +
    '<a class="nav-link" href="/">Library</a>' +
    '<button type="button" class="btn-ghost" id="logoutBtn">Log out</button>' +
    "</nav>";
  document.body.prepend(bar);
  mustLogoutButton().addEventListener("click", logout);
}

function mustLogoutButton(): HTMLButtonElement {
  const btn = document.getElementById("logoutBtn");
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Missing logout button");
  }
  return btn;
}
