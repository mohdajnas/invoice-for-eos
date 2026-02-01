import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAVcsbcLwaNEG4hzh3qH5FsyPg-vxZMM-w",
    authDomain: "invoice-boehm.firebaseapp.com",
    projectId: "invoice-boehm",
    storageBucket: "invoice-boehm.firebasestorage.app",
    messagingSenderId: "219414451688",
    appId: "1:219414451688:web:af3751e18be05ad1ce405d",
    measurementId: "G-MHF4HHMJYK"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth, analytics };
