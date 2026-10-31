import { setToken } from "./auth";
import { mustGet } from "./dom";
import type { AuthTokenResponse } from "./types";
import "./style.css";

const SIGNUP_URL = "/auth/register";

const emailInput = mustGet<HTMLInputElement>("signupEmail");
const passwordInput = mustGet<HTMLInputElement>("signupPassword");
const passwordConfInput = mustGet<HTMLInputElement>("signupPasswordConf");
const signupBtn = mustGet<HTMLButtonElement>("signupSubmit");
const errorEl = mustGet<HTMLParagraphElement>("signupError");

function showError(message: string): void {
  errorEl.textContent = message;
}

async function signup(): Promise<void> {
  showError("");

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const passwordConf = passwordConfInput.value;
  if (!email || !password || !passwordConf) {
    showError("Please enter your email and password.");
    return;
  }
  if (password !== passwordConf) {
    showError("Passwords do not match");
    return;
  }

  signupBtn.disabled = true;
  try {
    const res = await fetch(SIGNUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.status === 409) {
      showError("That email is already registered.");
      return;
    }
    if (res.status === 422) {
      showError("Use a valid email and a password of at least 8 characters.");
      return;
    }
    if (!res.ok) {
      showError("Signup failed (status " + res.status + ").");
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
    signupBtn.disabled = false;
  }
}

signupBtn.addEventListener("click", () => {
  void signup();
});
passwordConfInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void signup();
});
