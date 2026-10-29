
const SIGNUP_URL = "/auth/register";        
const TOKEN_KEY = "token";           
const TOKEN_FIELD = "access_token"; 

const emailInput = document.getElementById("signupEmail");
const passwordInput = document.getElementById("signupPassword");
const passwordConfInput = document.getElementById("signupPasswordConf");
const signupBtn = document.getElementById("signupSubmit");
const errorEl = document.getElementById("signupError");

function showError(message) {
  errorEl.textContent = message;
}

async function signup() {
  showError("");

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const passwordConf = passwordConfInput.value;
  if (!email || !password || !passwordConf) {
    showError("Please enter your email and password.");
    return;
  }
  if (password !== passwordConf){
    showError("Passwords do not match");
    return
  }

  signupBtn.disabled = true;
  try {
    const res = await fetch(SIGNUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.status === 401) {
      showError("Wrong email or password.");
      return;
    }
    if (!res.ok) {
      showError("Signup failed (status " + res.status + ").");
      return;
    }

    const data = await res.json();
    const token = data[TOKEN_FIELD];
    if (!token) {
      showError("The server did not return a token.");
      console.log("signup response:", data);  
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);
    window.location.href = "/";
  } catch (err) {
    console.error(err);
    showError("Could not reach the server.");
  } finally {
    signupBtn.disabled = false;
  }
}

signupBtn.addEventListener("click", signup);
passwordConfInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") signup();
});
