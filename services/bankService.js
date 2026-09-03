const { readStore, writeStore } = require('./budgetService');
const splitService = require('./splitService');

/**
 * Intelligent categorization rules based on merchant names & bank descriptions
 */
function detectCategory(merchant = '', rawDescription = '') {
  const text = (merchant + ' ' + rawDescription).toLowerCase();

  if (text.includes('rent') || text.includes('prop') || text.includes('lease') || text.includes('landlord') || text.includes('apex')) {
    return 'cat-rent';
  }
  if (text.includes('emi') || text.includes('loan') || text.includes('mortgage') || text.includes('chase auto') || text.includes('hdfc loan')) {
    return 'cat-emi';
  }
  if (text.includes('wifi') || text.includes('electric') || text.includes('fiber') || text.includes('utility') || text.includes('water') || text.includes('gas') || text.includes('coned')) {
    return 'cat-bills';
  }
  if (text.includes('grocery') || text.includes('costco') || text.includes('market') || text.includes('trader') || text.includes('safeway') || text.includes('walmart')) {
    return 'cat-grocery';
  }
  if (text.includes('fuel') || text.includes('petrol') || text.includes('shell') || text.includes('chevron') || text.includes('exxon') || text.includes('bp')) {
    return 'cat-petrol';
  }
  if (text.includes('bistro') || text.includes('cafe') || text.includes('restaurant') || text.includes('doordash') || text.includes('uber eats') || text.includes('swiggy') || text.includes('zomato')) {
    return 'cat-dining';
  }
  return 'cat-personal';
}

/**
 * Find default group that commonly splits this type of expense
 */
function detectSuggestedGroup(categoryId, store) {
  if (categoryId === 'cat-rent' || categoryId === 'cat-bills' || categoryId === 'cat-grocery') {
    // Default to Flatmates group if available
    const flatGroup = store.groups.find(g => g.id === 'group-flat' || g.name.toLowerCase().includes('flat') || g.name.toLowerCase().includes('roommate'));
    if (flatGroup) return flatGroup;
  }
  return store.groups[0] || null;
}

/**
 * Receive an incoming automated bank transaction webhook
 */
function receiveWebhookTransaction({ bankName, merchant, amount, rawDescription, date }) {
  const store = readStore();
  if (!store.pendingBankTransactions) store.pendingBankTransactions = [];

  const detectedCategory = detectCategory(merchant, rawDescription);
  const suggestedGroup = detectSuggestedGroup(detectedCategory, store);
  const numAmount = Math.round(Number(amount) * 100) / 100;

  const splitCount = suggestedGroup ? suggestedGroup.members.length : 1;
  const perPersonShare = Math.round((numAmount / splitCount) * 100) / 100;

  const pendingItem = {
    id: 'bank-tx-' + Date.now(),
    bankName: bankName || 'Bank Account ••4829',
    merchant: merchant || 'Unknown Merchant',
    amount: numAmount,
    date: date || new Date().toISOString(),
    rawDescription: rawDescription || merchant,
    detectedCategory,
    suggestedGroup: suggestedGroup ? suggestedGroup.id : null,
    suggestedGroupName: suggestedGroup ? suggestedGroup.name : null,
    splitCount,
    perPersonShare,
    status: 'PENDING_REVIEW'
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
    throw new Error('Bank transaction not found');
  }

  const tx = store.pendingBankTransactions[txIndex];
  let expenseResult = null;

  if (action === 'SPLIT') {
    const groupId = customGroupId || tx.suggestedGroup;
    const group = store.groups.find(g => g.id === groupId);
    const participants = group ? group.members : ['user-me'];

    expenseResult = splitService.addExpense({
      title: tx.merchant,
      amount: tx.amount,
      categoryId: customCategoryId || tx.detectedCategory,
      paidBy: 'user-me',
      isSplit: true,
      groupId,
      splitType: 'EQUAL',
      participants
    });

    // Broadcast notifications to roommates
    const share = Math.round((tx.amount / participants.length) * 100) / 100;
    broadcastNotification({
      title: `Auto-Sync: ${tx.merchant} Paid`,
      message: `Prateek's bank paid $${tx.amount.toFixed(2)}. $${share.toFixed(2)} split with ${group ? group.name : 'group'}.`,
      type: 'BANK_SPLIT_ADDED',
      targetGroup: group ? group.name : 'Shared'
    });

  } else if (action === 'PERSONAL') {
    expenseResult = splitService.addExpense({
      title: tx.merchant,
      amount: tx.amount,
      categoryId: customCategoryId || tx.detectedCategory,
      paidBy: 'user-me',
      isSplit: false,
      splitDetails: null
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
    id: 'notif-' + Date.now(),
    title,
    message,
    timestamp: new Date().toISOString(),
    type: type || 'GENERAL',
    targetGroup: targetGroup || 'General'
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

module.exports = {
  receiveWebhookTransaction,
  getPendingTransactions,
  processBankTransaction,
  broadcastNotification,
  getNotifications
};
