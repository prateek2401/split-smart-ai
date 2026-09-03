const { readStore, writeStore } = require('./budgetService');

/**
 * Calculates net balance for every friend relative to the current user.
 * Positive = They owe the current user
 * Negative = Current user owes them
 */
function getSplitwiseBalances() {
  const store = readStore();
  const currentUserId = store.currentUser.id;
  
  // Friend lookup map
  const userMap = {
    [store.currentUser.id]: store.currentUser
  };
  store.friends.forEach(f => {
    userMap[f.id] = f;
  });

  // Net balances map: userId -> net amount
  const balances = {};
  store.friends.forEach(f => {
    balances[f.id] = 0;
  });

  // 1. Process all split expenses
  store.expenses.forEach(exp => {
    if (!exp.isSplit || !exp.splitDetails || !Array.isArray(exp.splitDetails.shares)) return;

    const paidBy = exp.paidBy;

    if (paidBy === currentUserId) {
      // Current user paid for others: everyone else owes their share to current user
      exp.splitDetails.shares.forEach(share => {
        if (share.userId !== currentUserId && balances[share.userId] !== undefined) {
          balances[share.userId] += Number(share.amount) || 0;
        }
      });
    } else {
      // Someone else paid: did current user have a share?
      const currentUserShare = exp.splitDetails.shares.find(s => s.userId === currentUserId);
      if (currentUserShare && balances[paidBy] !== undefined) {
        // Current user owes the payer their share
        balances[paidBy] -= Number(currentUserShare.amount) || 0;
      }
    }
  });

  // 2. Process all settlement payments
  store.settlements.forEach(set => {
    if (set.fromUserId === currentUserId) {
      // Current user paid friend: reduces what current user owes (increases balance)
      if (balances[set.toUserId] !== undefined) {
        balances[set.toUserId] += Number(set.amount) || 0;
      }
    } else if (set.toUserId === currentUserId) {
      // Friend paid current user: reduces what friend owes (decreases balance)
      if (balances[set.fromUserId] !== undefined) {
        balances[set.fromUserId] -= Number(set.amount) || 0;
      }
    }
  });

  // Summary aggregation
  let totalYouAreOwed = 0;
  let totalYouOwe = 0;

  const friendsWithBalances = store.friends.map(friend => {
    const rawBalance = balances[friend.id] || 0;
    const netBalance = Math.round(rawBalance * 100) / 100;

    if (netBalance > 0) {
      totalYouAreOwed += netBalance;
    } else if (netBalance < 0) {
      totalYouOwe += Math.abs(netBalance);
    }

    return {
      ...friend,
      netBalance,
      status: netBalance > 0 ? 'OWES_YOU' : netBalance < 0 ? 'YOU_OWE' : 'SETTLED'
    };
  });

  // Calculate simplified debts for all friends who have non-zero balances
  const simplifiedDebts = [];
  friendsWithBalances.forEach(f => {
    if (f.netBalance > 0) {
      simplifiedDebts.push({
        from: f.name,
        to: store.currentUser.name,
        amount: f.netBalance
      });
    } else if (f.netBalance < 0) {
      simplifiedDebts.push({
        from: store.currentUser.name,
        to: f.name,
        amount: Math.abs(f.netBalance)
      });
    }
  });

  return {
    currentUser: store.currentUser,
    totalYouAreOwed: Math.round(totalYouAreOwed * 100) / 100,
    totalYouOwe: Math.round(totalYouOwe * 100) / 100,
    netBalance: Math.round((totalYouAreOwed - totalYouOwe) * 100) / 100,
    friends: friendsWithBalances,
    groups: store.groups,
    recentExpenses: store.expenses.slice(-10).reverse(),
    simplifiedDebts
  };
}

/**
 * Add a new expense (Personal or Split)
 */
function addExpense({ title, amount, categoryId, paidBy, isSplit, groupId, splitType, participants, customShares, paymentSource }) {
  const store = readStore();
  const numAmount = Math.round(Number(amount) * 100) / 100;
  const payer = paidBy || store.currentUser.id;

  let splitDetails = null;

  if (isSplit && Array.isArray(participants) && participants.length > 0) {
    let shares = [];

    if (splitType === 'EXACT' && Array.isArray(customShares)) {
      shares = customShares.map(s => ({
        userId: s.userId,
        amount: Math.round(Number(s.amount) * 100) / 100
      }));
    } else if (splitType === 'PERCENT' && Array.isArray(customShares)) {
      shares = customShares.map(s => ({
        userId: s.userId,
        amount: Math.round(((Number(s.percent) / 100) * numAmount) * 100) / 100
      }));
    } else {
      // Default: EQUAL split
      const perPerson = Math.round((numAmount / participants.length) * 100) / 100;
      let totalAssigned = 0;
      shares = participants.map((pId, idx) => {
        let pAmount = perPerson;
        if (idx === participants.length - 1) {
          // Adjust last penny difference
          pAmount = Math.round((numAmount - totalAssigned) * 100) / 100;
        } else {
          totalAssigned += pAmount;
        }
        return { userId: pId, amount: pAmount };
      });
    }

    splitDetails = {
      splitType: splitType || 'EQUAL',
      shares
    };
  }

  const newExpense = {
    id: 'exp-' + Date.now(),
    title: title.trim(),
    amount: numAmount,
    categoryId: categoryId || 'cat-personal',
    date: new Date().toISOString(),
    paidBy: payer,
    isSplit: Boolean(isSplit),
    groupId: groupId || null,
    splitDetails,
    paymentSource: paymentSource || null
  };

  store.expenses.push(newExpense);
  writeStore(store);

  return {
    expense: newExpense,
    balances: getSplitwiseBalances()
  };
}

/**
 * Settle debt between current user and a friend
 */
function settleUp({ friendId, amount }) {
  const store = readStore();
  const currentUserId = store.currentUser.id;
  const numAmount = Math.round(Number(amount) * 100) / 100;

  const newSettlement = {
    id: 'set-' + Date.now(),
    fromUserId: currentUserId,
    toUserId: friendId,
    amount: numAmount,
    date: new Date().toISOString()
  };

  store.settlements.push(newSettlement);
  writeStore(store);

  return {
    settlement: newSettlement,
    balances: getSplitwiseBalances()
  };
}

module.exports = {
  getSplitwiseBalances,
  addExpense,
  settleUp
};
