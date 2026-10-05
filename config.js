import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
export const firebaseConfig = {
  apiKey: "AIzaSyDOiiw_uCwd4UVtYVvnDWZQokn6_WkE9Eo",
  authDomain: "classmate-75660.firebaseapp.com",
  projectId: "classmate-75660",
  storageBucket: "classmate-75660.firebasestorage.app",
  messagingSenderId: "654872498882",
  appId: "1:654872498882:web:49a397b10d7347204ba15b",
  measurementId: "G-XM0971SYS0"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
