import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: " ",
  authDomain: " ",
  projectId: " ",
  storageBucket: " ",
  messagingSenderId: " ",
  appId: " ",
  measurementId: " "
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

setPersistence(auth, browserSessionPersistence)
  .then(() => {
    console.log("Session persistence set.");
  })
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

export { auth, provider };

