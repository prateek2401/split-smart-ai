// Firebase Phone Authentication Configuration
// Live Firebase Project: splitsmart-97771 (10,000 Free SMS/Month by Google)

let FIREBASE_CONFIG = {
  apiKey: "AIzaSyDrnwh79Qtxcwqp2Q7xiBAirD0mFz4B6a4",
  authDomain: "splitsmart-97771.firebaseapp.com",
  projectId: "splitsmart-97771",
  storageBucket: "splitsmart-97771.firebasestorage.app",
  messagingSenderId: "48074095957",
  appId: "1:48074095957:web:93ce2e5886bd728ecf03dc",
  measurementId: "G-DRH5KR8LBY"
};

// Check if valid Firebase configuration is active
function isFirebaseConfigured() {
  return typeof FIREBASE_CONFIG !== "undefined" &&
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.apiKey.startsWith("AIzaSy");
}

// Fetch configuration dynamically from Vercel Environment Variables if overridden
async function loadFirebaseConfigFromVercel() {
  try {
    const res = await fetch("/api/config/firebase").then(r => r.json());
    if (res.success && res.data && res.data.apiKey && res.data.apiKey.length > 5) {
      FIREBASE_CONFIG = { ...FIREBASE_CONFIG, ...res.data };
      console.log("✓ Overrode Firebase keys from Vercel Environment Variables");
    }
  } catch (e) {
    // Keep local defaults
  }
}

if (typeof window !== "undefined") {
  loadFirebaseConfigFromVercel();
}
