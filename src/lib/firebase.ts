import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyATMdZbN7MFOoO5_GD8fpaCw_gZu7D7dTE",
  authDomain: "math-mammoth-review.firebaseapp.com",
  projectId: "math-mammoth-review",
  storageBucket: "math-mammoth-review.firebasestorage.app",
  messagingSenderId: "815250542183",
  appId: "1:815250542183:web:4bb5d8e3be18ed4ff60ec2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
