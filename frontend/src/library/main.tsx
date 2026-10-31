import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { renderNav, requireAuth } from "../auth";
import "../style.css";
import { App } from "./App";

requireAuth();
renderNav();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
