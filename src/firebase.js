// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // You need this for login
import { getFirestore } from "firebase/firestore"; // You'll need this for data

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsF34srMvcq9k1QCcaPP8HSehQRi1-pgE",
  authDomain: "health-pal-d1722.firebaseapp.com",
  projectId: "health-pal-d1722",
  storageBucket: "health-pal-d1722.appspot.com", // Corrected this common typo
  messagingSenderId: "1075350260983",
  appId: "1:1075350260983:web:39fda85e0c6fb9c21c17f2",
  measurementId: "G-3XWGLBH7E6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services so other files can use them
export const auth = getAuth(app);
export const db = getFirestore(app);