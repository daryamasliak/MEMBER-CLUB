import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBM1PRG0DQ2pb3edP5bdvzLqaeI_4vzETE",
  authDomain: "memberclub-diploma.firebaseapp.com",
  projectId: "memberclub-diploma",
  storageBucket: "memberclub-diploma.firebasestorage.app",
  messagingSenderId: "804681742124",
  appId: "1:804681742124:web:f2bc84429dbe34f7f71e89",
  measurementId: "G-CC1GGHQKZ9",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
