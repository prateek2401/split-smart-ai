// Firebase Phone Authentication Configuration
// Automatically loads from Vercel Environment Variables or local settings

let FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Check if valid Firebase configuration is active
function isFirebaseConfigured() {
  return typeof FIREBASE_CONFIG !== "undefined" &&
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.apiKey.length > 10 &&
    !FIREBASE_CONFIG.apiKey.includes("YOUR_FIREBASE_API_KEY");
}

// Fetch configuration dynamically from Vercel Environment Variables on startup
async function loadFirebaseConfigFromVercel() {
  try {
    const res = await fetch("/api/config/firebase").then(r => r.json());
    if (res.success && res.data && res.data.apiKey) {
      FIREBASE_CONFIG = res.data;
      console.log("✓ Loaded Firebase keys from Vercel Environment Variables");
      if (typeof bankView !== "undefined" && typeof bankView.initFirebase === "function") {
        bankView.initFirebase();
      }
    }
  } catch (e) {
    // Local offline mode
  }
}

// Load on browser startup
if (typeof window !== "undefined") {
  loadFirebaseConfigFromVercel();
}
