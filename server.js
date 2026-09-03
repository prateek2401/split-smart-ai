const express = require('express');
const cors = require('cors');
const path = require('path');
const budgetService = require('./services/budgetService');
const splitService = require('./services/splitService');
const aiPredictorService = require('./services/aiPredictorService');
const bankService = require('./services/bankService');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// Budget Allocation Endpoints
// ----------------------------------------------------

// Get budget overview and category allocations
app.get('/api/budget', (req, res) => {
  try {
    const summary = budgetService.getBudgetSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update budget allocations (and optionally total income / target savings)
app.post('/api/budget/allocate', (req, res) => {
  try {
    const { allocations, totalIncome, targetSavings } = req.body;
    const updated = budgetService.updateAllocations(allocations, totalIncome, targetSavings);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a new custom budget category
app.post('/api/budget/category', (req, res) => {
  try {
    const { name, icon, allocated, isFixed, dueDay } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    const updated = budgetService.addCategory(name, icon, allocated, isFixed, dueDay);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Splitwise & Expense Endpoints
// ----------------------------------------------------

// Get Splitwise balances, debts, and transaction records
app.get('/api/splitwise', (req, res) => {
  try {
    const data = splitService.getSplitwiseBalances();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add an expense (Personal or Split)
app.post('/api/expenses', (req, res) => {
  try {
    const { title, amount, categoryId, paidBy, isSplit, groupId, splitType, participants, customShares } = req.body;
    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid title and positive amount required' });
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
app.post('/api/splitwise/settle', (req, res) => {
  try {
    const { friendId, amount } = req.body;
    if (!friendId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid friendId and positive amount required' });
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

// Get AI analysis: velocity, month-end forecast, annual projection, recommendations
app.get('/api/ai/predict', (req, res) => {
  try {
    const predictions = aiPredictorService.getAIPredictions();
    res.json({ success: true, data: predictions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Bank Application Webhook & Automated Sync Endpoints
// ----------------------------------------------------

// Inbound webhook from bank or open banking aggregator (Plaid / Setu / Teller)
app.post('/api/bank/webhook', (req, res) => {
  try {
    const { bankName, merchant, amount, rawDescription, date } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid debit amount required' });
    }
    const item = bankService.receiveWebhookTransaction({ bankName, merchant, amount, rawDescription, date });
    res.json({ success: true, message: 'Bank transaction received and categorized', data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulate a bank debit (Rent, Utilities, Grocery)
app.post('/api/bank/simulate', (req, res) => {
  try {
    const { type } = req.body;
    const presets = {
      rent: {
        bankName: 'Chase Bank ••4829',
        merchant: 'Apex Property Management (Apartment Rent)',
        amount: 1500.00,
        rawDescription: 'ACH DEBIT APEX PROP MGMT RENT 09/26'
      },
      wifi: {
        bankName: 'Capital One ••1904',
        merchant: 'ConEd & HighSpeed Fiber Utilities',
        amount: 85.00,
        rawDescription: 'DIRECT DEBIT CONED & INTERNET UTILITY'
      },
      groceries: {
        bankName: 'Chase Bank ••4829',
        merchant: 'Trader Joe\'s Supermarket Restock',
        amount: 135.50,
        rawDescription: 'POS DEBIT TRADER JOES #412'
      }
    };
    const chosen = presets[type] || presets.rent;
    const item = bankService.receiveWebhookTransaction(chosen);
    res.json({ success: true, message: `Simulated bank debit for ${item.merchant}`, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get pending bank transactions awaiting user 1-click review
app.get('/api/bank/pending', (req, res) => {
  try {
    const pending = bankService.getPendingTransactions();
    res.json({ success: true, data: pending });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Process a pending bank transaction (1-click split, personal, or dismiss)
app.post('/api/bank/process', (req, res) => {
  try {
    const { transactionId, action, customGroupId, customCategoryId } = req.body;
    if (!transactionId || !action) {
      return res.status(400).json({ success: false, error: 'transactionId and action (SPLIT, PERSONAL, DISMISS) required' });
    }
    const result = bankService.processBankTransaction({ transactionId, action, customGroupId, customCategoryId });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get roommate notification feed
app.get('/api/notifications', (req, res) => {
  try {
    const notifs = bankService.getNotifications();
    res.json({ success: true, data: notifs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SplitSmart AI Server running at http://localhost:${PORT}`);
  console.log(`📊 AI Savings Predictor & Splitwise Webapp Ready`);
  console.log(`=======================================================`);
});
