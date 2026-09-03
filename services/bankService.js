const { readStore, writeStore } = require("./budgetService");
const splitService = require("./splitService");

/**
 * Intelligent categorization rules based on merchant names & bank descriptions
 * Supports Indian payment merchants (Blinkit, Swiggy, Zomato, BESCOM, Shell, etc.)
 */
function detectCategory(merchant = "", rawDescription = "") {
  const text = (merchant + " " + rawDescription).toLowerCase();

  // Rent / Society
  if (text.includes("rent") || text.includes("prop") || text.includes("lease") || text.includes("landlord") || text.includes("apex") || text.includes("nobroker") || text.includes("housing")) {
    return "cat-rent";
  }
  // EMI & Loans
  if (text.includes("emi") || text.includes("loan") || text.includes("mortgage") || text.includes("chase auto") || text.includes("hdfc loan") || text.includes("bajaj")) {
    return "cat-emi";
  }
  // Utilities & Bills (Electricity, Broadband, WiFi, Gas, Water)
  if (text.includes("wifi") || text.includes("electric") || text.includes("fiber") || text.includes("utility") || text.includes("water") || text.includes("gas") || text.includes("coned") || text.includes("bescom") || text.includes("tneb") || text.includes("broadband") || text.includes("airtel") || text.includes("jio") || text.includes("act fibernet")) {
    return "cat-bills";
  }
  // Groceries & Quick Commerce (Blinkit, Zepto, Instamart, BigBasket, Costco, Supermarket)
  if (text.includes("grocery") || text.includes("costco") || text.includes("market") || text.includes("trader") || text.includes("safeway") || text.includes("walmart") || text.includes("blinkit") || text.includes("zepto") || text.includes("instamart") || text.includes("bigbasket") || text.includes("dmart")) {
    return "cat-grocery";
  }
  // Petrol & Fuel
  if (text.includes("fuel") || text.includes("petrol") || text.includes("diesel") || text.includes("shell") || text.includes("chevron") || text.includes("exxon") || text.includes("bp") || text.includes("hpcl") || text.includes("iocl") || text.includes("bpcl") || text.includes("indian oil")) {
    return "cat-petrol";
  }
  // Dining & Food Delivery (Swiggy, Zomato, Restaurant, Cafe, Bistro)
  if (text.includes("bistro") || text.includes("cafe") || text.includes("restaurant") || text.includes("doordash") || text.includes("uber eats") || text.includes("swiggy") || text.includes("zomato") || text.includes("mcdonald") || text.includes("starbucks") || text.includes("dominos") || text.includes("pizza")) {
    return "cat-dining";
  }
  // Health & Medicine
  if (text.includes("pharmacy") || text.includes("apollo") || text.includes("medplus") || text.includes("1mg") || text.includes("hospital") || text.includes("practo") || text.includes("clinic") || text.includes("doctor")) {
    return "cat-health";
  }
  return "cat-personal";
}

/**
 * Find default group that commonly splits this type of expense
 */
function detectSuggestedGroup(categoryId, store) {
  if (categoryId === "cat-rent" || categoryId === "cat-bills" || categoryId === "cat-grocery") {
    const flatGroup = store.groups.find(g => g.id === "group-flat" || g.name.toLowerCase().includes("flat") || g.name.toLowerCase().includes("roommate"));
    if (flatGroup) return flatGroup;
  }
  return store.groups[0] || null;
}

/**
 * Natural Language / Regex SMS & Notification Parser
 * Parses debit messages from HDFC Bank, PhonePe, Paytm, Google Pay
 */
function parseSmsOrNotification(text = "") {
  // Extract Amount: e.g. Rs 1500, Rs. 1,500.00, INR 1500, ₹1500
  let amount = 0;
  const amtMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ""));
  }

  // Detect Source App & Bank
  let sourceApp = "UPI App";
  let bankName = "Bank Account";

  if (/phonepe/i.test(text)) sourceApp = "PhonePe";
  else if (/paytm/i.test(text)) sourceApp = "Paytm";
  else if (/gpay|google pay/i.test(text)) sourceApp = "Google Pay";
  else if (/hdfc/i.test(text)) sourceApp = "HDFC Mobile";

  if (/hdfc/i.test(text)) bankName = "HDFC Bank";
  else if (/sbi/i.test(text)) bankName = "SBI";
  else if (/icici/i.test(text)) bankName = "ICICI Bank";
  else if (/axis/i.test(text)) bankName = "Axis Bank";

  // Detect Merchant/Payee: e.g. "to Apex Rent", "at Blinkit", "for Electricity", "to Landlord Sharma"
  let merchant = "Automated Payment";
  const merchantMatch = text.match(/(?:to|at|for|VPA)\s+([A-Za-z0-9\s#&._-]+?)(?:\s+(?:on|via|ref|using|dated|\.|UPI|$))/i);
  if (merchantMatch && merchantMatch[1].trim().length > 2) {
    merchant = merchantMatch[1].trim();
  }

  const categoryId = detectCategory(merchant, text);

  // Check if expense is typically shared
  const isSplit = categoryId === "cat-rent" || categoryId === "cat-bills" || categoryId === "cat-grocery" || /split|roommate|dinner|flat/i.test(text);

  return {
    amount,
    sourceApp,
    bankName,
    merchant,
    categoryId,
    isSplit,
    rawText: text
  };
}

/**
 * Direct Auto-Capture: Immediately logs expense to user or roommate ledger
 */
function autoCapturePayment({ sourceApp, bankName, merchant, amount, categoryId, paidBy, isSplit, groupId, splitType = "EQUAL" }) {
  const store = readStore();
  const numAmount = Math.round(Number(amount) * 100) / 100;
  const payer = paidBy || store.currentUser.id;
  const category = categoryId || detectCategory(merchant, "");

  let participants = [];
  let targetGroupId = null;

  if (isSplit) {
    const suggested = groupId ? store.groups.find(g => g.id === groupId) : detectSuggestedGroup(category, store);
    if (suggested) {
      targetGroupId = suggested.id;
      participants = suggested.members;
    } else {
      participants = [store.currentUser.id];
    }
  }

  const paymentSource = `${sourceApp || "PhonePe"} • ${bankName || "HDFC Bank"}`;

  const expenseResult = splitService.addExpense({
    title: merchant,
    amount: numAmount,
    categoryId: category,
    paidBy: payer,
    isSplit: Boolean(isSplit),
    groupId: targetGroupId,
    splitType,
    participants,
    paymentSource
  });

  // Determine payer display name
  const payerUser = payer === store.currentUser.id ? store.currentUser : store.friends.find(f => f.id === payer);
  const payerName = payerUser ? payerUser.name : "You";

  // Broadcast alert to roommates
  broadcastNotification({
    title: `📱 ${sourceApp || "PhonePe"} Payment Auto-Added`,
    message: `${payerName} paid ${store.currentUser.currency || "₹"}${numAmount.toFixed(2)} for ${merchant} via ${paymentSource}. ${isSplit ? "Split across roommates." : "Logged as personal expense."}`,
    type: "APP_PAYMENT_CAPTURED",
    targetGroup: targetGroupId ? "Flat #402 Roommates" : "Personal"
  });

  return {
    success: true,
    expenseResult,
    paymentSource,
    autoAdded: true
  };
}

/**
 * Receive an incoming automated bank transaction webhook (stages in pending review)
 */
function receiveWebhookTransaction({ bankName, merchant, amount, rawDescription, date, sourceApp = "Bank App" }) {
  const store = readStore();
  if (!store.pendingBankTransactions) store.pendingBankTransactions = [];

  const detectedCategory = detectCategory(merchant, rawDescription);
  const suggestedGroup = detectSuggestedGroup(detectedCategory, store);
  const numAmount = Math.round(Number(amount) * 100) / 100;

  const splitCount = suggestedGroup ? suggestedGroup.members.length : 1;
  const perPersonShare = Math.round((numAmount / splitCount) * 100) / 100;

  const pendingItem = {
    id: "bank-tx-" + Date.now(),
    sourceApp,
    bankName: bankName || "HDFC Bank ••4829",
    merchant: merchant || "Unknown Merchant",
    amount: numAmount,
    date: date || new Date().toISOString(),
    rawDescription: rawDescription || merchant,
    detectedCategory,
    suggestedGroup: suggestedGroup ? suggestedGroup.id : null,
    suggestedGroupName: suggestedGroup ? suggestedGroup.name : null,
    splitCount,
    perPersonShare,
    status: "PENDING_REVIEW"
  };

  store.pendingBankTransactions.unshift(pendingItem);
  writeStore(store);

  return pendingItem;
}

function getPendingTransactions() {
  const store = readStore();
  return store.pendingBankTransactions || [];
}

/**
 * Process a pending bank transaction (Split, Personal, or Dismiss)
 */
function processBankTransaction({ transactionId, action, customGroupId, customCategoryId }) {
  const store = readStore();
  if (!store.pendingBankTransactions) store.pendingBankTransactions = [];

  const txIndex = store.pendingBankTransactions.findIndex(t => t.id === transactionId);
  if (txIndex === -1) {
    throw new Error("Bank transaction not found");
  }

  const tx = store.pendingBankTransactions[txIndex];
  let expenseResult = null;

  const paymentSource = `${tx.sourceApp || "Bank App"} • ${tx.bankName}`;

  if (action === "SPLIT") {
    const groupId = customGroupId || tx.suggestedGroup;
    const group = store.groups.find(g => g.id === groupId);
    const participants = group ? group.members : ["user-me"];

    expenseResult = splitService.addExpense({
      title: tx.merchant,
      amount: tx.amount,
      categoryId: customCategoryId || tx.detectedCategory,
      paidBy: "user-me",
      isSplit: true,
      groupId,
      splitType: "EQUAL",
      participants,
      paymentSource
    });

    const share = Math.round((tx.amount / participants.length) * 100) / 100;
    broadcastNotification({
      title: `Auto-Sync: ${tx.merchant} Paid`,
      message: `Prateek paid ${store.currentUser.currency || "₹"}${tx.amount.toFixed(2)} via ${paymentSource}. ${store.currentUser.currency || "₹"}${share.toFixed(2)} split with ${group ? group.name : "group"}.`,
      type: "BANK_SPLIT_ADDED",
      targetGroup: group ? group.name : "Shared"
    });

  } else if (action === "PERSONAL") {
    expenseResult = splitService.addExpense({
      title: tx.merchant,
      amount: tx.amount,
      categoryId: customCategoryId || tx.detectedCategory,
      paidBy: "user-me",
      isSplit: false,
      splitDetails: null,
      paymentSource
    });
  }

  // Remove from pending in fresh store
  const freshStore = readStore();
  const freshTxIndex = freshStore.pendingBankTransactions.findIndex(t => t.id === transactionId);
  if (freshTxIndex !== -1) {
    freshStore.pendingBankTransactions.splice(freshTxIndex, 1);
    writeStore(freshStore);
  }

  return {
    success: true,
    action,
    expenseResult,
    remainingPending: freshStore.pendingBankTransactions
  };
}

function broadcastNotification({ title, message, type, targetGroup }) {
  const store = readStore();
  if (!store.notifications) store.notifications = [];

  const newNotif = {
    id: "notif-" + Date.now(),
    title,
    message,
    timestamp: new Date().toISOString(),
    type: type || "GENERAL",
    targetGroup: targetGroup || "General"
  };

  store.notifications.unshift(newNotif);
  if (store.notifications.length > 30) {
    store.notifications = store.notifications.slice(0, 30);
  }
  writeStore(store);
  return newNotif;
}

function getNotifications() {
  const store = readStore();
  return store.notifications || [];
}

function connectBankAccount({ bankName, accountNumber, accountType }) {
  const store = readStore();
  if (!store.connectedBanks) store.connectedBanks = [];

  const bankId = "bank-acc-" + Date.now();
  const consentId = (bankName.replace(/[^A-Za-z]/g, "").toUpperCase() || "BANK") + "_AA_" + Math.floor(100000 + Math.random() * 900000);

  const newBank = {
    id: bankId,
    bankName: bankName || "HDFC Bank",
    accountType: accountType || "Savings Account",
    accountNumber: accountNumber || "••" + Math.floor(1000 + Math.random() * 9000),
    consentId,
    status: "ACTIVE",
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString()
  };

  store.connectedBanks.unshift(newBank);
  writeStore(store);

  broadcastNotification({
    title: `🏦 ${newBank.bankName} Connected Successfully`,
    message: `Authorized read-only feed for ${newBank.accountType} (${newBank.accountNumber}) via App-to-App deep link. Consent ID: ${consentId}.`,
    type: "BANK_CONNECTED",
    targetGroup: "All Accounts"
  });

  return newBank;
}

function getConnectedBanks() {
  const store = readStore();
  return store.connectedBanks || [];
}

function disconnectBank(bankId) {
  const store = readStore();
  if (!store.connectedBanks) store.connectedBanks = [];
  store.connectedBanks = store.connectedBanks.filter(b => b.id !== bankId);
  writeStore(store);
  return { success: true };
}



const AVAILABLE_PAYMENT_SOURCES = [
  // UPI & Wallets
  { id: "phonepe", name: "PhonePe UPI & Wallet", type: "UPI", icon: "🟣", defaultChecked: true },
  { id: "gpay", name: "Google Pay (GPay)", type: "UPI", icon: "🔵", defaultChecked: true },
  { id: "paytm", name: "Paytm UPI & Wallet", type: "UPI", icon: "💠", defaultChecked: true },
  { id: "amazonpay", name: "Amazon Pay UPI", type: "UPI", icon: "🟠", defaultChecked: true },
  { id: "cred", name: "CRED UPI & Pay", type: "UPI", icon: "⚫", defaultChecked: true },

  // Bank Accounts
  { id: "hdfc", name: "HDFC Bank (Savings/Salary)", type: "BANK", icon: "🏦", defaultChecked: true },
  { id: "sbi", name: "State Bank of India (SBI)", type: "BANK", icon: "🏦", defaultChecked: true },
  { id: "icici", name: "ICICI Bank (iMobile)", type: "BANK", icon: "🏦", defaultChecked: true },
  { id: "axis", name: "Axis Bank Mobile", type: "BANK", icon: "🏦", defaultChecked: true },
  { id: "kotak", name: "Kotak Mahindra Bank", type: "BANK", icon: "🏦", defaultChecked: false },
  { id: "other_bank", name: "Other NetBanking / IMPS", type: "BANK", icon: "🏛️", defaultChecked: false },

  // Cards & PayLater
  { id: "credit_cards", name: "Credit Cards (HDFC / ICICI / SBI)", type: "CARD", icon: "💳", defaultChecked: true },
  { id: "pay_later", name: "LazyPay / Simpl PayLater", type: "CARD", icon: "⚡", defaultChecked: false }
];

function getPaymentSources() {
  const store = readStore();
  const activeIds = store.activePaymentSources || ["phonepe", "gpay", "paytm", "hdfc", "sbi", "icici", "axis", "cred", "amazonpay"];
  return AVAILABLE_PAYMENT_SOURCES.map(src => ({
    ...src,
    isActive: activeIds.includes(src.id)
  }));
}

function updatePaymentSources(activeIds) {
  const store = readStore();
  store.activePaymentSources = Array.isArray(activeIds) ? activeIds : [];
  writeStore(store);

  broadcastNotification({
    title: "⚙️ Payment Modes & Banks Updated",
    message: `Active auto-sync monitoring enabled for ${store.activePaymentSources.length} payment sources.`,
    type: "PAYMENT_SOURCES_UPDATED",
    targetGroup: "Sync Settings"
  });

  return getPaymentSources();
}



// Active OTP storage in memory for verification
const activeOtpSessions = new Map();

function sendMobileOtp({ phone, bankName = "HDFC Bank", upiId }) {
  if (!phone || phone.trim().length < 10) {
    throw new Error("Valid 10-digit Indian mobile number required");
  }

  const cleanPhone = phone.replace(/[^0-9]/g, "").slice(-10);
  const otp = "482910"; // Reliable demo OTP (or Math.floor(100000 + Math.random() * 900000))
  const cleanUpiId = upiId ? upiId.trim() : `${cleanPhone}@ybl`;

  activeOtpSessions.set(cleanPhone, {
    otp,
    bankName,
    upiId: cleanUpiId,
    timestamp: Date.now()
  });

  return {
    success: true,
    message: `Verification OTP sent via SMS to +91 ${cleanPhone}`,
    phone: cleanPhone,
    demoOtp: otp,
    upiId: cleanUpiId
  };
}

function verifyOtpAndDiscoverAccounts({ phone, otp, bankName = "HDFC Bank" }) {
  const cleanPhone = phone.replace(/[^0-9]/g, "").slice(-10);
  const session = activeOtpSessions.get(cleanPhone);

  if (!session) {
    throw new Error("No active OTP request found for this mobile number. Please request a new OTP.");
  }

  if (otp.trim() !== session.otp && otp.trim() !== "482910" && otp.trim() !== "123456") {
    throw new Error("Invalid OTP entered. Please check your SMS and try again.");
  }

  const store = readStore();
  const upiId = session.upiId || `${cleanPhone}@ybl`;
  const last4 = cleanPhone.slice(-4);

  // Auto-discover accounts tied to this mobile number
  const discoveredAccounts = [
    {
      id: "acc-phonepe-" + cleanPhone,
      sourceType: "PHONEPE",
      title: "PhonePe UPI Account",
      vpa: upiId,
      logo: "🟣",
      status: "VERIFIED"
    },
    {
      id: "acc-bank-" + cleanPhone,
      sourceType: "BANK",
      title: `${bankName} Primary Account`,
      accountType: "Savings Account",
      accountNumber: `••••${last4}`,
      logo: "🏦",
      status: "DISCOVERED"
    },
    {
      id: "acc-card-" + cleanPhone,
      sourceType: "CREDIT_CARD",
      title: `${bankName} Platinum Credit Card`,
      accountType: "Credit Card",
      accountNumber: `••••${(parseInt(last4) + 1234).toString().slice(-4)}`,
      logo: "💳",
      status: "DISCOVERED"
    }
  ];

  // Persist to user profile
  store.currentUser.phone = `+91 ${cleanPhone}`;
  store.currentUser.upiId = upiId;
  store.currentUser.linkedBank = `${bankName} ••••${last4}`;

  // Add to connected banks
  if (!store.connectedBanks) store.connectedBanks = [];
  const existing = store.connectedBanks.find(b => b.bankName === bankName);
  if (!existing) {
    store.connectedBanks.unshift({
      id: "bank-acc-" + Date.now(),
      bankName: bankName,
      accountType: "Savings Account",
      accountNumber: `••••${last4}`,
      phone: `+91 ${cleanPhone}`,
      upiId,
      consentId: "PHONEPE_AA_" + Math.floor(100000 + Math.random() * 900000),
      status: "ACTIVE",
      connectedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    });
  }

  writeStore(store);
  activeOtpSessions.delete(cleanPhone);

  broadcastNotification({
    title: `📱 PhonePe & ${bankName} Linked (+91 ${cleanPhone})`,
    message: `Mobile number verified via SMS OTP. Linked PhonePe VPA (${upiId}) and ${bankName} A/C ••••${last4} for real-time debit monitoring.`,
    type: "PHONEPE_LINKED",
    targetGroup: "All Accounts"
  });

  return {
    success: true,
    phone: `+91 ${cleanPhone}`,
    upiId,
    bankName,
    discoveredAccounts
  };
}


module.exports = {
  sendMobileOtp,
  verifyOtpAndDiscoverAccounts,
  getPaymentSources,
  updatePaymentSources,
  detectCategory,
  parseSmsOrNotification,
  autoCapturePayment,
  receiveWebhookTransaction,
  getPendingTransactions,
  processBankTransaction,
  broadcastNotification,
  getNotifications,
  connectBankAccount,
  getConnectedBanks,
  disconnectBank
};
