import { redirectIfAuthed, setToken } from "./auth";
import { mustGet } from "./dom";
import type { AuthTokenResponse } from "./types";
import "./style.css";

const LOGIN_URL = "/auth/login";

redirectIfAuthed();

const emailInput = mustGet<HTMLInputElement>("loginEmail");
const passwordInput = mustGet<HTMLInputElement>("loginPassword");
const loginBtn = mustGet<HTMLButtonElement>("loginSubmit");
const errorEl = mustGet<HTMLParagraphElement>("loginError");

function showError(message: string): void {
  errorEl.textContent = message;
}

async function login(): Promise<void> {
  showError("");

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  loginBtn.disabled = true;
  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.status === 401) {
      showError("Wrong email or password.");
      return;
    }
    if (!res.ok) {
      showError("Login failed (status " + res.status + ").");
      return;
    }

    const data = (await res.json()) as AuthTokenResponse;
    if (!data.access_token) {
      showError("The server did not return a token.");
      return;
    }

    setToken(data.access_token);
    window.location.href = "/";
  } catch (err) {
    console.error(err);
    showError("Could not reach the server.");
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", () => {
  void login();
});
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void login();
});
