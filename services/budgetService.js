const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

function readStore() {
  const raw = fs.readFileSync(STORE_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Calculates user's net personal spending per category for the active month.
 * Handles both personal expenses and split expenses (only counts the user's personal share).
 */
function getCategorySpending(store) {
  const currentUserId = store.currentUser.id;
  const spendingMap = {};

  store.monthlyBudget.categories.forEach(cat => {
    spendingMap[cat.id] = {
      allocated: Number(cat.allocated) || 0,
      spent: 0,
      remaining: Number(cat.allocated) || 0,
      percentage: 0,
      status: 'HEALTHY'
    };
  });

  store.expenses.forEach(exp => {
    const catId = exp.categoryId;
    if (!spendingMap[catId]) return;

    let userExpensePortion = 0;
    if (!exp.isSplit) {
      if (exp.paidBy === currentUserId) {
        userExpensePortion = Number(exp.amount) || 0;
      }
    } else if (exp.splitDetails && Array.isArray(exp.splitDetails.shares)) {
      const userShare = exp.splitDetails.shares.find(s => s.userId === currentUserId);
      if (userShare) {
        userExpensePortion = Number(userShare.amount) || 0;
      }
    }

    spendingMap[catId].spent += userExpensePortion;
  });

  // Calculate remaining and status
  Object.keys(spendingMap).forEach(catId => {
    const item = spendingMap[catId];
    item.remaining = Math.max(0, item.allocated - item.spent);
    item.percentage = item.allocated > 0 ? Math.round((item.spent / item.allocated) * 100) : 0;

    if (item.percentage >= 100) {
      item.status = 'CRITICAL';
    } else if (item.percentage >= 80) {
      item.status = 'WARNING';
    } else {
      item.status = 'HEALTHY';
    }
  });

  return spendingMap;
}

function getBudgetSummary() {
  const store = readStore();
  const spendingMap = getCategorySpending(store);

  let totalAllocated = 0;
  let totalSpent = 0;

  const enrichedCategories = store.monthlyBudget.categories.map(cat => {
    const stats = spendingMap[cat.id] || { spent: 0, remaining: cat.allocated, percentage: 0, status: 'HEALTHY' };
    totalAllocated += Number(cat.allocated) || 0;
    totalSpent += stats.spent;

    return {
      ...cat,
      spent: stats.spent,
      remaining: stats.remaining,
      percentage: stats.percentage,
      status: stats.status
    };
  });

  const totalIncome = Number(store.monthlyBudget.totalIncome) || 0;
  const targetSavings = Number(store.monthlyBudget.targetSavings) || 0;
  const unallocated = Math.max(0, totalIncome - totalAllocated - targetSavings);

  return {
    month: store.monthlyBudget.month,
    currency: store.currentUser.currency || '$',
    totalIncome,
    targetSavings,
    totalAllocated,
    unallocated,
    totalSpent,
    totalRemaining: Math.max(0, totalAllocated - totalSpent),
    overallBurnPercent: totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0,
    categories: enrichedCategories
  };
}

function updateAllocations(newAllocations, totalIncome, targetSavings) {
  const store = readStore();

  if (totalIncome !== undefined) {
    store.monthlyBudget.totalIncome = Number(totalIncome);
  }
  if (targetSavings !== undefined) {
    store.monthlyBudget.targetSavings = Number(targetSavings);
  }

  if (Array.isArray(newAllocations)) {
    newAllocations.forEach(alloc => {
      const cat = store.monthlyBudget.categories.find(c => c.id === alloc.id);
      if (cat && alloc.allocated !== undefined) {
        cat.allocated = Math.max(0, Number(alloc.allocated));
      }
    });
  }

  writeStore(store);
  return getBudgetSummary();
}

function addCategory(name, icon, allocated, isFixed, dueDay) {
  const store = readStore();
  const id = 'cat-' + Date.now();
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#8b5cf6', '#14b8a6'];
  const color = colors[store.monthlyBudget.categories.length % colors.length];

  const newCat = {
    id,
    name: name.trim(),
    icon: icon || '🏷️',
    color,
    allocated: Number(allocated) || 0,
    isFixed: Boolean(isFixed),
    dueDay: dueDay ? Number(dueDay) : null
  };

  store.monthlyBudget.categories.push(newCat);
  writeStore(store);
  return getBudgetSummary();
}

module.exports = {
  readStore,
  writeStore,
  getBudgetSummary,
  updateAllocations,
  addCategory
};
