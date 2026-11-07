import { auth, db } from "../firebase.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const LOGIN_PAGE = "login.html";
const STAFF_ROLES = ["admin", "manager"];

let guardPromise = null;

function redirectToLogin() {
  window.location.replace(LOGIN_PAGE);
}

export function requireStaff() {
  guardPromise ??= new Promise((resolve) => {
    let isReady = false;

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        redirectToLogin();
        return;
      }

      if (isReady) return;

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const profile = snapshot.exists() ? snapshot.data() : null;

        if (
          !profile ||
          !STAFF_ROLES.includes(profile.role) ||
          profile.status !== "active"
        ) {
          await signOut(auth);
          redirectToLogin();
          return;
        }

        isReady = true;

        resolve({
          user,
          role: profile.role,
          name: profile.name || user.email,
          profile,
        });
      } catch (error) {
        console.error("Auth guard failed:", error);
        redirectToLogin();
      }
    });
  });

  return guardPromise;
}

export function isAdmin(staff) {
  return staff?.role === "admin";
}

export async function requireRole(allowedRoles) {
  const staff = await requireStaff();

  if (!allowedRoles.includes(staff.role)) {
    window.location.replace("access-denied.html");
    return null;
  }

  return staff;
}
