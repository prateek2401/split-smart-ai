const { readStore } = require('./budgetService');

/**
 * AI Savings & Expenditure Prediction Engine
 */
function getAIPredictions() {
  const store = readStore();
  const currentUserId = store.currentUser.id;
  const now = new Date();

  // Calendar calculations
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = Math.min(Math.max(now.getDate(), 1), totalDaysInMonth);
  const remainingDays = totalDaysInMonth - currentDay;
  const monthProgressPct = Math.round((currentDay / totalDaysInMonth) * 100);

  const totalIncome = Number(store.monthlyBudget.totalIncome) || 0;
  const targetSavings = Number(store.monthlyBudget.targetSavings) || 0;

  // Track spend breakdown (Fixed vs Variable)
  let fixedBudgetTotal = 0;
  let fixedSpentTotal = 0;
  let variableBudgetTotal = 0;
  let variableSpentTotal = 0;

  const categoryAnalysis = store.monthlyBudget.categories.map(cat => {
    let catSpent = 0;

    store.expenses.forEach(exp => {
      if (exp.categoryId !== cat.id) return;
      if (!exp.isSplit) {
        if (exp.paidBy === currentUserId) catSpent += Number(exp.amount) || 0;
      } else if (exp.splitDetails && Array.isArray(exp.splitDetails.shares)) {
        const share = exp.splitDetails.shares.find(s => s.userId === currentUserId);
        if (share) catSpent += Number(share.amount) || 0;
      }
    });

    const allocated = Number(cat.allocated) || 0;
    const isFixed = Boolean(cat.isFixed);

    if (isFixed) {
      fixedBudgetTotal += allocated;
      fixedSpentTotal += catSpent;
    } else {
      variableBudgetTotal += allocated;
      variableSpentTotal += catSpent;
    }

    // Expected spend percentage based on day of month for variable categories
    const actualBurnPct = allocated > 0 ? (catSpent / allocated) * 100 : 0;
    const isLeaking = !isFixed && actualBurnPct > (monthProgressPct + 15);

    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      allocated,
      spent: catSpent,
      remaining: Math.max(0, allocated - catSpent),
      isFixed,
      burnPercentage: Math.round(actualBurnPct),
      isLeaking
    };
  });

  const totalSpentSoFar = fixedSpentTotal + variableSpentTotal;

  // Daily Variable Burn Velocity ($ / day)
  const effectiveElapsedDays = Math.max(currentDay, 1);
  const dailyVariableVelocity = Math.round((variableSpentTotal / effectiveElapsedDays) * 100) / 100;

  // Forecast Remaining Spend:
  // 1. Expected variable spend for remaining days based on current daily velocity
  const projectedRemainingVariable = Math.round(dailyVariableVelocity * remainingDays);

  // 2. Remaining unpaid fixed bills (e.g., if Rent or EMI hasn't been logged yet)
  let unpaidFixedBills = 0;
  categoryAnalysis.filter(c => c.isFixed).forEach(c => {
    if (c.spent === 0) {
      unpaidFixedBills += c.allocated;
    }
  });

  // Predicted Total Monthly Outflow
  const predictedTotalSpend = Math.round(totalSpentSoFar + projectedRemainingVariable + unpaidFixedBills);

  // Month-End Savings Forecast
  const predictedSavings = Math.round(totalIncome - predictedTotalSpend);
  const savingsVariance = predictedSavings - targetSavings;
  const savingsGoalProgress = targetSavings > 0 ? Math.round((predictedSavings / targetSavings) * 100) : 100;

  let predictionStatus = 'ON_TRACK';
  if (predictedSavings < 0) {
    predictionStatus = 'DEFICIT';
  } else if (predictedSavings < targetSavings * 0.8) {
    predictionStatus = 'AT_RISK';
  }

  // 12-Month Annual Projection
  const annualIncome = totalIncome * 12;
  const projectedAnnualSavings = Math.round(predictedSavings * 12);
  const targetAnnualSavings = targetSavings * 12;
  const compoundInterest7Pct = Math.round(projectedAnnualSavings * 1.045); // Approximate 1st-year compound on monthly contributions

  // AI-Generated Insights & Actionable Recommendations
  const recommendations = [];

  // Insight 1: Spending Velocity
  if (dailyVariableVelocity > (variableBudgetTotal / totalDaysInMonth)) {
    const idealVelocity = Math.round((variableBudgetTotal / totalDaysInMonth) * 10) / 10;
    recommendations.push({
      type: 'WARNING',
      title: 'High Burn Rate Detected',
      message: `Your variable spend velocity is currently ${store.currentUser.currency}${dailyVariableVelocity}/day, exceeding your budgeted pace of ${store.currentUser.currency}${idealVelocity}/day.`,
      action: `Cap non-essential daily spending to ${store.currentUser.currency}${idealVelocity} to secure your savings goal.`
    });
  } else {
    recommendations.push({
      type: 'SUCCESS',
      title: 'Disciplined Spend Pace',
      message: `Your daily variable burn rate (${store.currentUser.currency}${dailyVariableVelocity}/day) is within your safe monthly trajectory.`,
      action: 'Keep up this momentum to exceed your monthly savings target.'
    });
  }

  // Insight 2: Category Leaks
  const leakingCategories = categoryAnalysis.filter(c => c.isLeaking);
  if (leakingCategories.length > 0) {
    const leakNames = leakingCategories.map(c => `${c.icon} ${c.name}`).join(', ');
    recommendations.push({
      type: 'CRITICAL',
      title: `Category Budget Alert: ${leakNames}`,
      message: `${leakNames} is consuming budget significantly faster than the calendar pace (${monthProgressPct}% through the month).`,
      action: `Pause discretionary purchases in these categories for the next 7 days to avoid budget overrun.`
    });
  }

  // Insight 3: Splitwise Receivable Liquidity
  let totalReceivable = 0;
  store.friends.forEach(f => {
    // Check friend balance
    let b = 0;
    store.expenses.forEach(e => {
      if (e.isSplit && e.paidBy === currentUserId) {
        const s = e.splitDetails?.shares?.find(sh => sh.userId === f.id);
        if (s) b += s.amount;
      } else if (e.isSplit && e.paidBy === f.id) {
        const s = e.splitDetails?.shares?.find(sh => sh.userId === currentUserId);
        if (s) b -= s.amount;
      }
    });
    if (b > 0) totalReceivable += b;
  });

  if (totalReceivable > 0) {
    recommendations.push({
      type: 'INFO',
      title: 'Splitwise Receivable Buffer',
      message: `You are owed a total of ${store.currentUser.currency}${Math.round(totalReceivable)} by friends from shared expenses.`,
      action: 'Settling up these debts will immediately boost your available liquid cash buffer.'
    });
  }

  // Insight 4: Smart Reallocation
  const underBudgetCats = categoryAnalysis.filter(c => !c.isFixed && c.burnPercentage < 25 && c.allocated > 150);
  if (leakingCategories.length > 0 && underBudgetCats.length > 0) {
    const fromCat = underBudgetCats[0];
    const toCat = leakingCategories[0];
    recommendations.push({
      type: 'SMART_OPTIMIZATION',
      title: `AI Rebalancing Opportunity`,
      message: `You have surplus buffer in ${fromCat.icon} ${fromCat.name} while ${toCat.icon} ${toCat.name} is running hot.`,
      action: `Safely shift ${store.currentUser.currency}50 from ${fromCat.name} to ${toCat.name} to prevent overall budget deficit.`
    });
  }

  // What-If Simulator Benchmarks
  const whatIfCuts = [5, 10, 15, 20].map(pct => {
    const monthlyExtraSavings = Math.round(variableSpentTotal * (pct / 100) + (projectedRemainingVariable * (pct / 100)));
    const annualExtraSavings = monthlyExtraSavings * 12;
    return {
      cutPercentage: pct,
      monthlyExtraSavings,
      annualExtraSavings
    };
  });

  return {
    timeline: {
      currentDay,
      totalDaysInMonth,
      remainingDays,
      monthProgressPct
    },
    monthlyOverview: {
      totalIncome,
      targetSavings,
      totalSpentSoFar,
      fixedSpentTotal,
      variableSpentTotal,
      unpaidFixedBills,
      dailyVariableVelocity
    },
    predictions: {
      predictedTotalSpend,
      predictedSavings,
      savingsVariance,
      savingsGoalProgress,
      status: predictionStatus
    },
    annualForecast: {
      annualIncome,
      projectedAnnualSavings,
      targetAnnualSavings,
      compoundInterest7Pct
    },
    categoryAnalysis,
    recommendations,
    whatIfCuts
  };
}

module.exports = {
  getAIPredictions
};
