const path = require("path");
const { readStore, writeStore } = require("./budgetService");

function getStore() {
  return readStore();
}

function googleSSO({ email, name, avatar }) {
  const store = getStore();
  if (!store.users) store.users = [];

  let user = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    user = {
      id: "user-" + Date.now(),
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || email)}`,
      currency: store.currentUser?.currency || "$",
      currencyCode: store.currentUser?.currencyCode || "USD",
      authProvider: "GOOGLE",
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
  } else {
    if (avatar) user.avatar = avatar;
    if (name) user.name = name;
  }

  store.currentUser = user;
  writeStore(store);
  return user;
}

function register({ name, email, password, currency = "$", currencyCode = "USD" }) {
  const store = getStore();
  if (!store.users) store.users = [];

  const existing = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error("Account with this email already exists");
  }

  const user = {
    id: "user-" + Date.now(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: password, // In production use bcrypt
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
    currency: currency || "$",
    currencyCode: currencyCode || "USD",
    authProvider: "LOCAL",
    hasCompletedOnboarding: false,
    createdAt: new Date().toISOString()
  };

  store.users.push(user);
  store.currentUser = user;
  writeStore(store);
  return user;
}

function login({ email, password }) {
  const store = getStore();
  if (!store.users) store.users = [];

  const user = store.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user) {
    throw new Error("No account found with this email");
  }

  if (user.authProvider === "LOCAL" && user.password !== password) {
    throw new Error("Invalid password");
  }

  store.currentUser = user;
  writeStore(store);
  return user;
}

function updateCurrency(currencySymbol, currencyCode) {
  const store = getStore();
  if (!store.currentUser) return { currency: "$" };

  store.currentUser.currency = currencySymbol;
  store.currentUser.currencyCode = currencyCode || "USD";

  // Also update user in users array
  if (store.users) {
    const u = store.users.find(usr => usr.id === store.currentUser.id);
    if (u) {
      u.currency = currencySymbol;
      u.currencyCode = currencyCode || "USD";
    }
  }

  writeStore(store);
  return store.currentUser;
}

function completeOnboarding({ currency, currencyCode, totalIncome, targetSavings }) {
  const store = getStore();
  if (currency) {
    store.currentUser.currency = currency;
    store.currentUser.currencyCode = currencyCode || "USD";
  }
  store.currentUser.hasCompletedOnboarding = true;

  if (store.monthlyBudget) {
    if (totalIncome) store.monthlyBudget.totalIncome = Number(totalIncome);
    if (targetSavings) store.monthlyBudget.targetSavings = Number(targetSavings);
  }

  writeStore(store);
  return store.currentUser;
}

module.exports = {
  googleSSO,
  register,
  login,
  updateCurrency,
  completeOnboarding
};
