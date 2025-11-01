import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDaj2S1n-N_UoWJQRe2lL4y0MH3TClpKOQ",
  authDomain: "soultalk-9593e.firebaseapp.com",
  projectId: "soultalk-9593e",
  storageBucket: "soultalk-9593e.appspot.com",
  messagingSenderId: "448686836510",
  appId: "1:448686836510:web:25287b37a04b547e8c570f",
  measurementId: "G-3N62YCJ5WH"
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
