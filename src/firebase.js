// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCLH3U_rTE6GhOFCXy0uu5JZCLUj1gK-dI",
  authDomain: "govote-f644d.firebaseapp.com",
  projectId: "govote-f644d",
  storageBucket: "govote-f644d.firebasestorage.app",
  messagingSenderId: "805631998103",
  appId: "1:805631998103:web:1ef8bc4f8661e1c55d51d2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

export { app, auth, db, functions, storage, firebaseConfig };