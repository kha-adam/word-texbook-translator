const LOGIN_URL = "/auth/login";        
const TOKEN_KEY = "token";           
const TOKEN_FIELD = "access_token"; 

const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginSubmit");
const errorEl = document.getElementById("loginError");

function showError(message) {
  errorEl.textContent = message;
}

async function login() {
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

    const data = await res.json();
    const token = data[TOKEN_FIELD];
    if (!token) {
      showError("The server did not return a token.");
      console.log("login response:", data);  
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);
    window.location.href = "/";
  } catch (err) {
    console.error(err);
    showError("Could not reach the server.");
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});