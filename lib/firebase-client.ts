import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!;
  app = initializeApp(firebaseConfig);
  return app;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(getFirebaseApp());
}
