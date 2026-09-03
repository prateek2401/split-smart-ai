const fs = require("fs");
const path = require("path");

const DEFAULT_STORE_PATH = path.join(__dirname, "..", "data", "store.json");
const VERCEL_STORE_PATH = path.join("/tmp", "store.json");

let inMemoryStore = null;

function getStorePath() {
  if (process.env.VERCEL) {
    if (!fs.existsSync(VERCEL_STORE_PATH)) {
      try {
        const seed = fs.readFileSync(DEFAULT_STORE_PATH, "utf-8");
        fs.writeFileSync(VERCEL_STORE_PATH, seed, "utf-8");
      } catch (e) {
        return DEFAULT_STORE_PATH;
      }
    }
    return VERCEL_STORE_PATH;
  }
  return DEFAULT_STORE_PATH;
}

function readStore() {
  try {
    const p = getStorePath();
    const raw = fs.readFileSync(p, "utf-8");
    inMemoryStore = JSON.parse(raw);
    return inMemoryStore;
  } catch (err) {
    if (inMemoryStore) return inMemoryStore;
    const raw = fs.readFileSync(DEFAULT_STORE_PATH, "utf-8");
    return JSON.parse(raw);
  }
}

function writeStore(data) {
  inMemoryStore = data;
  try {
    const p = getStorePath();
    fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    // Graceful fallback for read-only serverless
  }
}

function ensureMonthlyBudgets(store, month) {
  if (!store.monthlyBudgets) {
    store.monthlyBudgets = {};
    if (store.monthlyBudget) {
      store.monthlyBudgets[store.monthlyBudget.month || "2026-09"] = JSON.parse(JSON.stringify(store.monthlyBudget));
    }
  }

  if (!store.monthlyBudgets[month]) {
    // Copy baseline from an existing month or default
    const fallbackMonth = Object.keys(store.monthlyBudgets)[0] || "2026-09";
    const template = store.monthlyBudgets[fallbackMonth] || store.monthlyBudget;
    store.monthlyBudgets[month] = {
      month,
      totalIncome: template.totalIncome || 5200,
      targetSavings: template.targetSavings || 1200,
      categories: JSON.parse(JSON.stringify(template.categories || []))
    };
  }

  if (!store.seasonalPayments) {
    store.seasonalPayments = [
      {
        id: "season-1",
        title: "Annual Car & Health Insurance Premium",
        amount: 650,
        categoryId: "cat-health",
        appliesToMonth: "2026-10",
        icon: "🛡️",
        isPaid: false
      }
    ];
  }
}

function getCategorySpending(store, targetMonth) {
  const currentUserId = store.currentUser.id;
  const activeBudget = store.monthlyBudgets[targetMonth] || store.monthlyBudget;
  const spendingMap = {};

  activeBudget.categories.forEach(cat => {
    spendingMap[cat.id] = {
      allocated: Number(cat.allocated) || 0,
      spent: 0,
      remaining: Number(cat.allocated) || 0,
      percentage: 0,
      status: "HEALTHY"
    };
  });

  store.expenses.forEach(exp => {
    // Check if expense belongs to targetMonth
    const expDate = exp.date || "";
    if (!expDate.startsWith(targetMonth)) return;

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

  Object.keys(spendingMap).forEach(catId => {
    const item = spendingMap[catId];
    item.remaining = Math.max(0, item.allocated - item.spent);
    item.percentage = item.allocated > 0 ? Math.round((item.spent / item.allocated) * 100) : 0;

    if (item.percentage >= 100) {
      item.status = "CRITICAL";
    } else if (item.percentage >= 80) {
      item.status = "WARNING";
    } else {
      item.status = "HEALTHY";
    }
  });

  return spendingMap;
}

function getBudgetSummary(requestedMonth = null) {
  const store = readStore();
  const currentMonth = requestedMonth || store.monthlyBudget?.month || "2026-09";
  ensureMonthlyBudgets(store, currentMonth);

  const activeBudget = store.monthlyBudgets[currentMonth];
  const spendingMap = getCategorySpending(store, currentMonth);

  let totalAllocated = 0;
  let totalSpent = 0;

  const enrichedCategories = activeBudget.categories.map(cat => {
    const stats = spendingMap[cat.id] || { spent: 0, remaining: cat.allocated, percentage: 0, status: "HEALTHY" };
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

  // Seasonal payments for this month
  const activeSeasonal = (store.seasonalPayments || []).filter(s => s.appliesToMonth === currentMonth);
  let seasonalTotal = 0;
  activeSeasonal.forEach(s => seasonalTotal += Number(s.amount) || 0);

  const totalIncome = Number(activeBudget.totalIncome) || 0;
  const targetSavings = Number(activeBudget.targetSavings) || 0;
  const unallocated = Math.max(0, totalIncome - totalAllocated - targetSavings - seasonalTotal);

  return {
    month: currentMonth,
    availableMonths: Object.keys(store.monthlyBudgets).sort(),
    currency: store.currentUser?.currency || "$",
    currencyCode: store.currentUser?.currencyCode || "USD",
    totalIncome,
    targetSavings,
    totalAllocated,
    seasonalTotal,
    seasonalPayments: activeSeasonal,
    unallocated,
    totalSpent,
    totalRemaining: Math.max(0, totalAllocated - totalSpent),
    overallBurnPercent: totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0,
    categories: enrichedCategories
  };
}

function updateAllocations(newAllocations, totalIncome, targetSavings, targetMonth = null) {
  const store = readStore();
  const month = targetMonth || store.monthlyBudget?.month || "2026-09";
  ensureMonthlyBudgets(store, month);

  const activeBudget = store.monthlyBudgets[month];

  if (totalIncome !== undefined) {
    activeBudget.totalIncome = Number(totalIncome);
  }
  if (targetSavings !== undefined) {
    activeBudget.targetSavings = Number(targetSavings);
  }

  if (Array.isArray(newAllocations)) {
    newAllocations.forEach(alloc => {
      const cat = activeBudget.categories.find(c => c.id === alloc.id);
      if (cat && alloc.allocated !== undefined) {
        cat.allocated = Math.max(0, Number(alloc.allocated));
      }
    });
  }

  // Also keep store.monthlyBudget in sync if same month
  if (store.monthlyBudget && store.monthlyBudget.month === month) {
    store.monthlyBudget.totalIncome = activeBudget.totalIncome;
    store.monthlyBudget.targetSavings = activeBudget.targetSavings;
    store.monthlyBudget.categories = activeBudget.categories;
  }

  writeStore(store);
  return getBudgetSummary(month);
}

function copyBudgetToMonth(fromMonth, toMonth) {
  const store = readStore();
  ensureMonthlyBudgets(store, fromMonth);
  ensureMonthlyBudgets(store, toMonth);

  const source = store.monthlyBudgets[fromMonth];
  store.monthlyBudgets[toMonth] = {
    month: toMonth,
    totalIncome: source.totalIncome,
    targetSavings: source.targetSavings,
    categories: JSON.parse(JSON.stringify(source.categories))
  };

  writeStore(store);
  return getBudgetSummary(toMonth);
}

function addSeasonalPayment({ title, amount, categoryId, appliesToMonth, icon }) {
  const store = readStore();
  if (!store.seasonalPayments) store.seasonalPayments = [];

  const newSeasonal = {
    id: "season-" + Date.now(),
    title: title.trim(),
    amount: Math.round(Number(amount) * 100) / 100,
    categoryId: categoryId || "cat-health",
    appliesToMonth: appliesToMonth || "2026-10",
    icon: icon || "🛡️",
    isPaid: false
  };

  store.seasonalPayments.push(newSeasonal);
  writeStore(store);
  return getBudgetSummary(appliesToMonth);
}

function addCategory(name, icon, allocated, isFixed, dueDay, targetMonth = null) {
  const store = readStore();
  const month = targetMonth || store.monthlyBudget?.month || "2026-09";
  ensureMonthlyBudgets(store, month);

  const activeBudget = store.monthlyBudgets[month];
  const id = "cat-" + Date.now();
  const colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#8b5cf6", "#14b8a6"];
  const color = colors[activeBudget.categories.length % colors.length];

  const newCat = {
    id,
    name: name.trim(),
    icon: icon || "🏷️",
    color,
    allocated: Number(allocated) || 0,
    isFixed: Boolean(isFixed),
    dueDay: dueDay ? Number(dueDay) : null
  };

  activeBudget.categories.push(newCat);
  writeStore(store);
  return getBudgetSummary(month);
}

module.exports = {
  readStore,
  writeStore,
  getBudgetSummary,
  updateAllocations,
  copyBudgetToMonth,
  addSeasonalPayment,
  addCategory
};
