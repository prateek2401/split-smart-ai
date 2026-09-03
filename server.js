const express = require('express');
const cors = require('cors');
const path = require('path');
const budgetService = require('./services/budgetService');
const splitService = require('./services/splitService');
const aiPredictorService = require('./services/aiPredictorService');

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
