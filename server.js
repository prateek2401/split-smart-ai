const express = require("express");
const cors = require("cors");
const path = require("path");
const budgetService = require("./services/budgetService");
const splitService = require("./services/splitService");
const aiPredictorService = require("./services/aiPredictorService");
const bankService = require("./services/bankService");
const authService = require("./services/authService");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ----------------------------------------------------
// Authentication & User Profile Endpoints
// ----------------------------------------------------

// Google SSO Login / Signup
app.post("/api/auth/google-sso", (req, res) => {
  try {
    const { email, name, avatar } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Valid email required for Google SSO" });
    }
    const user = authService.googleSSO({ email, name, avatar });
    res.json({ success: true, message: "Google SSO successful", data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Standard Email/Password Registration
app.post("/api/auth/register", (req, res) => {
  try {
    const { name, email, password, currency, currencyCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required" });
    }
    const user = authService.register({ name, email, password, currency, currencyCode });
    res.json({ success: true, message: "Registration successful", data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Standard Login
app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }
    const user = authService.login({ email, password });
    res.json({ success: true, message: "Login successful", data: user });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// Update Preferred Currency ($ USD, ₹ INR, € EUR, £ GBP)
app.post("/api/user/currency", (req, res) => {
  try {
    const { currency, currencyCode } = req.body;
    if (!currency) {
      return res.status(400).json({ success: false, error: "Currency symbol required" });
    }
    const updatedUser = authService.updateCurrency(currency, currencyCode);
    res.json({ success: true, message: `Currency set to ${currency} (${currencyCode})`, data: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Complete Onboarding (Currency, Initial Income & Savings Goal)
app.post("/api/user/onboarding", (req, res) => {
  try {
    const { currency, currencyCode, totalIncome, targetSavings } = req.body;
    const user = authService.completeOnboarding({ currency, currencyCode, totalIncome, targetSavings });
    res.json({ success: true, message: "Onboarding complete", data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Budget Allocation Endpoints (Multi-Month & Seasonal)
// ----------------------------------------------------

// Get budget overview and category allocations (supports ?month=YYYY-MM)
app.get("/api/budget", (req, res) => {
  try {
    const month = req.query.month || null;
    const summary = budgetService.getBudgetSummary(month);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update budget allocations for a specific month
app.post("/api/budget/allocate", (req, res) => {
  try {
    const { allocations, totalIncome, targetSavings, month } = req.body;
    const updated = budgetService.updateAllocations(allocations, totalIncome, targetSavings, month);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Duplicate / Copy budget from one month to another
app.post("/api/budget/copy", (req, res) => {
  try {
    const { fromMonth, toMonth } = req.body;
    if (!fromMonth || !toMonth) {
      return res.status(400).json({ success: false, error: "fromMonth and toMonth required" });
    }
    const result = budgetService.copyBudgetToMonth(fromMonth, toMonth);
    res.json({ success: true, message: `Budget duplicated from ${fromMonth} to ${toMonth}`, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add month-specific seasonal bill (e.g. Car Insurance in October)
app.post("/api/budget/seasonal", (req, res) => {
  try {
    const { title, amount, categoryId, appliesToMonth, icon } = req.body;
    if (!title || !amount || Number(amount) <= 0 || !appliesToMonth) {
      return res.status(400).json({ success: false, error: "Title, positive amount, and appliesToMonth required" });
    }
    const result = budgetService.addSeasonalPayment({ title, amount, categoryId, appliesToMonth, icon });
    res.json({ success: true, message: "Seasonal payment added", data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add custom category
app.post("/api/budget/category", (req, res) => {
  try {
    const { name, icon, allocated, isFixed, dueDay, month } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, error: "Category name is required" });
    }
    const updated = budgetService.addCategory(name, icon, allocated, isFixed, dueDay, month);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Splitwise & Expense Endpoints
// ----------------------------------------------------

// Get Splitwise balances, debts, and transaction records
app.get("/api/splitwise", (req, res) => {
  try {
    const data = splitService.getSplitwiseBalances();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add an expense (Personal or Split)
app.post("/api/expenses", (req, res) => {
  try {
    const { title, amount, categoryId, paidBy, isSplit, groupId, splitType, participants, customShares } = req.body;
    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Valid title and positive amount required" });
    }

    const result = splitService.addExpense({
      title,
      amount,
      categoryId,
      paidBy,
      isSplit,
      groupId,
      splitType,
      participants,
      customShares
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Settle up a debt with a friend
app.post("/api/splitwise/settle", (req, res) => {
  try {
    const { friendId, amount } = req.body;
    if (!friendId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Valid friendId and positive amount required" });
    }

    const result = splitService.settleUp({ friendId, amount });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// AI Savings Prediction Endpoints
// ----------------------------------------------------

app.get("/api/ai/predict", (req, res) => {
  try {
    const predictions = aiPredictorService.getAIPredictions();
    res.json({ success: true, data: predictions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Bank Webhook & Automated Sync Endpoints
// ----------------------------------------------------

app.post("/api/bank/webhook", (req, res) => {
  try {
    const { bankName, merchant, amount, rawDescription, date } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Valid debit amount required" });
    }
    const item = bankService.receiveWebhookTransaction({ bankName, merchant, amount, rawDescription, date });
    res.json({ success: true, message: "Bank transaction received and categorized", data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Inbound PhonePe, Paytm & Bank Direct Auto-Capture

// Bank Connection & App-to-App Linking Endpoints

// Payment Modes & Banks Checkbox Configuration Endpoints

// PhonePe & Bank Mobile OTP Verification Endpoints
app.post("/api/bank/send-otp", (req, res) => {
  try {
    const { phone, bankName, upiId } = req.body;
    const result = bankService.sendMobileOtp({ phone, bankName, upiId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/bank/verify-otp", (req, res) => {
  try {
    const { phone, otp, bankName } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: "Mobile number and OTP required" });
    }
    const result = bankService.verifyOtpAndDiscoverAccounts({ phone, otp, bankName });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get("/api/bank/sources", (req, res) => {
  try {
    const sources = bankService.getPaymentSources();
    res.json({ success: true, data: sources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bank/sources", (req, res) => {
  try {
    const { activeIds } = req.body;
    const updated = bankService.updatePaymentSources(activeIds);
    res.json({ success: true, message: "Active payment modes updated successfully!", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/bank/accounts", (req, res) => {
  try {
    const accounts = bankService.getConnectedBanks();
    res.json({ success: true, data: accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bank/connect", (req, res) => {
  try {
    const { bankName, accountNumber, accountType } = req.body;
    if (!bankName) {
      return res.status(400).json({ success: false, error: "Bank name is required" });
    }
    const connected = bankService.connectBankAccount({ bankName, accountNumber, accountType });
    res.json({ success: true, message: `Connected ${connected.bankName} successfully!`, data: connected });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bank/disconnect", (req, res) => {
  try {
    const { bankId } = req.body;
    if (!bankId) {
      return res.status(400).json({ success: false, error: "Bank ID is required" });
    }
    const result = bankService.disconnectBank(bankId);
    res.json({ success: true, message: "Bank feed disconnected and consent revoked", data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bank/auto-capture", (req, res) => {
  try {
    const { sourceApp, bankName, merchant, amount, categoryId, paidBy, isSplit, groupId } = req.body;
    if (!amount || Number(amount) <= 0 || !merchant) {
      return res.status(400).json({ success: false, error: "Merchant and positive amount required" });
    }
    const result = bankService.autoCapturePayment({
      sourceApp: sourceApp || "PhonePe",
      bankName: bankName || "HDFC Bank",
      merchant,
      amount: Number(amount),
      categoryId,
      paidBy: paidBy || "user-me",
      isSplit: Boolean(isSplit),
      groupId: groupId || null
    });
    res.json({ success: true, message: `Payment of ${amount} via ${sourceApp || "PhonePe"} auto-added to expenses`, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paste & Parse Bank / UPI Debit SMS
app.post("/api/bank/parse-sms", (req, res) => {
  try {
    const { text, autoAdd = true, paidBy } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ success: false, error: "SMS or notification text required" });
    }

    const parsed = bankService.parseSmsOrNotification(text);
    if (!parsed.amount || parsed.amount <= 0) {
      return res.status(400).json({ success: false, error: "Could not detect a debit amount in message. Example: Rs 1500 debited..." });
    }

    if (autoAdd) {
      const result = bankService.autoCapturePayment({
        sourceApp: parsed.sourceApp,
        bankName: parsed.bankName,
        merchant: parsed.merchant,
        amount: parsed.amount,
        categoryId: parsed.categoryId,
        paidBy: paidBy || "user-me",
        isSplit: parsed.isSplit,
        rawText: text
      });
      res.json({ success: true, message: `Parsed and auto-added ${parsed.sourceApp} payment of ${parsed.amount} to ${parsed.merchant}`, data: { parsed, result } });
    } else {
      const item = bankService.receiveWebhookTransaction({
        bankName: parsed.bankName,
        merchant: parsed.merchant,
        amount: parsed.amount,
        rawDescription: text,
        sourceApp: parsed.sourceApp
      });
      res.json({ success: true, message: "Parsed and staged for 1-click review", data: item });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Preset Simulations for PhonePe, Paytm and HDFC Bank
app.post("/api/bank/simulate", (req, res) => {
  try {
    const { type } = req.body;
    const presets = {
      // 1. PhonePe Rent Payment (Split with Flatmates)
      "phonepe-rent": {
        sourceApp: "PhonePe",
        bankName: "HDFC Bank ••4829",
        merchant: "Apex Property Management (Apartment Rent)",
        amount: 1500.00,
        categoryId: "cat-rent",
        paidBy: "user-me",
        isSplit: true,
        groupId: "group-flat"
      },
      // 2. Paytm Groceries at Blinkit (Split with Flatmates)
      "paytm-grocery": {
        sourceApp: "Paytm",
        bankName: "HDFC Bank ••4829",
        merchant: "Blinkit Quick Commerce Groceries",
        amount: 650.00,
        categoryId: "cat-grocery",
        paidBy: "user-me",
        isSplit: true,
        groupId: "group-flat"
      },
      // 3. HDFC NetBanking Electricity Bill (Split with Flatmates)
      "hdfc-bills": {
        sourceApp: "HDFC NetBanking",
        bankName: "HDFC Bank ••4829",
        merchant: "BESCOM HighSpeed Fiber & Electricity Bill",
        amount: 2200.00,
        categoryId: "cat-bills",
        paidBy: "user-me",
        isSplit: true,
        groupId: "group-flat"
      },
      // 4. Roommate Aarav Paid for Group Dinner via PhonePe
      "phonepe-aarav-dinner": {
        sourceApp: "PhonePe",
        bankName: "SBI ••9912",
        merchant: "Punjabi Tadka Bistro & Dinner",
        amount: 1200.00,
        categoryId: "cat-dining",
        paidBy: "friend-1", // Aarav paid
        isSplit: true,
        groupId: "group-flat"
      },
      // Fallback
      rent: {
        sourceApp: "PhonePe",
        bankName: "HDFC Bank ••4829",
        merchant: "Apex Property Management (Apartment Rent)",
        amount: 1500.00,
        categoryId: "cat-rent",
        paidBy: "user-me",
        isSplit: true,
        groupId: "group-flat"
      }
    };

    const chosen = presets[type] || presets["phonepe-rent"];
    const result = bankService.autoCapturePayment(chosen);
    res.json({
      success: true,
      message: `⚡ Auto-Captured ${chosen.sourceApp} payment of ${chosen.amount} for ${chosen.merchant}!`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/bank/pending", (req, res) => {
  try {
    const pending = bankService.getPendingTransactions();
    res.json({ success: true, data: pending });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bank/process", (req, res) => {
  try {
    const { transactionId, action, customGroupId, customCategoryId } = req.body;
    if (!transactionId || !action) {
      return res.status(400).json({ success: false, error: "transactionId and action required" });
    }
    const result = bankService.processBankTransaction({ transactionId, action, customGroupId, customCategoryId });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/notifications", (req, res) => {
  try {
    const notifs = bankService.getNotifications();
    res.json({ success: true, data: notifs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all route to serve SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log("=======================================================");
    console.log(`🚀 SplitSmart AI Server running at http://localhost:${PORT}`);
    console.log("📊 Auth, Multi-Month Allocations & Bank Sync Active");
    console.log("=======================================================");
  });
}

module.exports = app;
