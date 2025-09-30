import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyDbuxY_WFZpnGMBl8_ppH8tEYT2P69kGyE",
    authDomain: "organizador-cronograma.firebaseapp.com",
    projectId: "organizador-cronograma",
    storageBucket: "organizador-cronograma.firebasestorage.app",
    messagingSenderId: "718638007566",
    appId: "1:718638007566:web:de56ff73d696c9ca9f435f",
    measurementId: "G-38WE0ZGLTW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);