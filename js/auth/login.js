import { auth } from "../firebase.js";

import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const errorMessage = document.querySelector("#form-error");
const successMessage = document.querySelector("#form-success");
const submitButton = loginForm?.querySelector('[type="submit"]');

const togglePasswordButton = document.querySelector("#toggle-password");

function showError(message) {
  if (!errorMessage) {
    alert(message);
    return;
  }

  errorMessage.textContent = message;
  errorMessage.hidden = false;

  if (successMessage) {
    successMessage.hidden = true;
  }
}

function getLoginErrorMessage(errorCode) {
  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email address or password is incorrect.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";

    default:
      return "Unable to sign in. Please try again.";
  }
}

togglePasswordButton?.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";
  togglePasswordButton.textContent = isHidden ? "Hide" : "Show";
  togglePasswordButton.setAttribute(
    "aria-label",
    isHidden ? "Hide password" : "Show password",
  );
  togglePasswordButton.setAttribute("aria-pressed", String(isHidden));
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (errorMessage) {
    errorMessage.hidden = true;
    errorMessage.textContent = "";
  }

  if (successMessage) {
    successMessage.hidden = true;
  }

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "Signing in...";
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);

    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("Sign-in failed:", error);
    showError(getLoginErrorMessage(error.code));
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "Sign in";
    }
  }
});
