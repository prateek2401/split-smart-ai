// Firebase Phone Authentication Configuration
// Provides 10,000 FREE SMS verifications every month by Google!
//
// HOW TO GET YOUR FREE FIREBASE KEYS (Takes 60 Seconds - 100% Free, No Credit Card):
// 1. Visit https://console.firebase.google.com/ and click "Add Project" (name it SplitSmart).
// 2. Click "Authentication" in the left sidebar -> "Sign-in method" -> Enable "Phone".
// 3. In Project Settings (gear icon) -> Scroll down to "Your apps" -> Click "</>" (Web) -> Copy the config object below.

const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "splitsmart-ai.firebaseapp.com",
  projectId: "splitsmart-ai",
  storageBucket: "splitsmart-ai.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

// Check if user has entered real Firebase API keys
function isFirebaseConfigured() {
  return typeof FIREBASE_CONFIG !== "undefined" &&
    FIREBASE_CONFIG.apiKey &&
    !FIREBASE_CONFIG.apiKey.includes("YOUR_FIREBASE_API_KEY");
}
