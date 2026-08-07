import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

// User's provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBK1N4JIQubMM2zyL7JyokrnM7dMmzMSn8",
  authDomain: "cyclist-tracker.firebaseapp.com",
  databaseURL: "https://cyclist-tracker-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "cyclist-tracker",
  storageBucket: "cyclist-tracker.firebasestorage.app",
  messagingSenderId: "744363193261",
  appId: "1:744363193261:web:b9b43e9b12bcecaedee724",
  measurementId: "G-9QWLE052NW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
