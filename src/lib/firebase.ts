import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBAhuybF3tz1oh6j9HtNfhyo52tAX_t-_4",
  authDomain: "apple-net-df0e7.firebaseapp.com",
  databaseURL: "https://apple-net-df0e7-default-rtdb.firebaseio.com",
  projectId: "apple-net-df0e7",
  storageBucket: "apple-net-df0e7.firebasestorage.app",
  messagingSenderId: "910060697351",
  appId: "1:910060697351:android:177b0075a87ca0cb5ab7a2",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
