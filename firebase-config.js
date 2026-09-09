import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, doc, setDoc, getDoc, updateDoc, arrayUnion, query, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6A09UYfNJH84hdnCa1YRhJa_7SJplNt0",
    authDomain: "entrepre-d7396.firebaseapp.com",
    projectId: "entrepre-d7396",
    storageBucket: "entrepre-d7396.firebasestorage.app",
    messagingSenderId: "630944878630",
    appId: "1:630944878630:web:bc525e1c15a1257bb416e7",
    measurementId: "G-521YZP53HP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { app, db, auth, provider, collection, addDoc, serverTimestamp, getDocs, doc, setDoc, getDoc, updateDoc, arrayUnion, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut, query, where, limit };
