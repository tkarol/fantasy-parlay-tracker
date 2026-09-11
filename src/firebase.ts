import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDso9tSS2DwsYBOer_i13T0Bx-ND8lQEBk",
    authDomain: "fantasy-parlay-tracker.firebaseapp.com",
    projectId: "fantasy-parlay-tracker",
    storageBucket: "fantasy-parlay-tracker.firebasestorage.app",
    messagingSenderId: "373597683047",
    appId: "1:373597683047:web:ef8e7fd45e80113df403c2",
    measurementId: "G-HBXLPB4P4Q"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
