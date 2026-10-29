const TOKEN_KEY = "token";

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}
function logout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.replace("/login");
}
if (!getToken()) {
    window.location.replace("/login");
}

async function authFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${getToken()}` }
    });
    if (res.status === 401) logout();
    return res;
}

function renderNav(){
    const bar = document.createElement("div");
    bar.id = "navbar";
    bar.innerHTML = '<a href="/">My files</a><button id="logoutBtn">Logout</button>';
    document.body.prepend(bar);
    document.getElementById("logoutBtn").addEventListener("click", logout);
}
document.addEventListener("DOMContentLoaded", renderNav);