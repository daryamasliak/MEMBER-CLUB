import { auth } from "./firebase.js";

import { signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { requireStaff } from "./components/auth-guard.js";

const sidebar = document.querySelector("#admin-sidebar");
const menuToggle = document.querySelector("#mobile-menu-toggle");
const sidebarClose = document.querySelector("#sidebar-close");
const logoutButton = document.querySelector("#logout-button");

const staff = await requireStaff();

if (staff.role !== "admin") {
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = true;
  });
}

logoutButton?.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await signOut(auth);
    window.location.replace("login.html");
  } catch (error) {
    console.error("Sign-out failed:", error);
    alert("Unable to log out. Please try again.");
    logoutButton.disabled = false;
  }
});

const mobileQuery = window.matchMedia("(max-width: 760px)");

function setMenuOpen(isOpen) {
  document.body.classList.toggle("menu-open", isOpen);
  menuToggle?.setAttribute("aria-expanded", String(isOpen));
}

setMenuOpen(!mobileQuery.matches);

requestAnimationFrame(() => {
  document.body.classList.add("menu-ready");
});

mobileQuery.addEventListener("change", () => {
  setMenuOpen(!mobileQuery.matches);
});

menuToggle?.addEventListener("click", () => setMenuOpen(true));
sidebarClose?.addEventListener("click", () => setMenuOpen(false));

document.addEventListener("click", (event) => {
  if (!sidebar || !menuToggle) return;
  if (!mobileQuery.matches) return;
  if (!document.body.classList.contains("menu-open")) return;

  const clickedInsideSidebar = sidebar.contains(event.target);
  const clickedMenuButton = menuToggle.contains(event.target);

  if (!clickedInsideSidebar && !clickedMenuButton) {
    setMenuOpen(false);
  }
});
