import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

// TODO: USER - Replace these values with your Firebase Project Configuration
// You can find these in Project Settings -> General -> Your Apps -> SDK Setup and Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
