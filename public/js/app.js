// Main Application Controller
const app = {
  state: {
    budget: null,
    splitwise: null,
    ai: null
  },

  async init() {
    this.setupNavigation();
    await this.refreshAll();
  },

  async refreshAll() {
    try {
      const [budgetRes, splitRes, aiRes] = await Promise.all([
        fetch('/api/budget').then(r => r.json()),
        fetch('/api/splitwise').then(r => r.json()),
        fetch('/api/ai/predict').then(r => r.json())
      ]);

      if (budgetRes.success) this.state.budget = budgetRes.data;
      if (splitRes.success) this.state.splitwise = splitRes.data;
      if (aiRes.success) this.state.ai = aiRes.data;

      this.renderDashboard();
      budgetView.init(this.state.budget);
      splitView.init(this.state.splitwise);
      aiView.init(this.state.ai);
      if (typeof bankView !== 'undefined') await bankView.init();
      this.populateCategorySelect();
    } catch (err) {
      console.error('Failed to load application data:', err);
      this.showToast('❌ Error loading data from server');
    }
  },

  renderDashboard() {
    const b = this.state.budget;
    const s = this.state.splitwise;
    if (!b) return;

    // Overview Stats
    const totalIncome = document.getElementById('dashTotalIncome');
    const allocated = document.getElementById('dashAllocated');
    const unallocated = document.getElementById('dashUnallocated');
    const totalSpent = document.getElementById('dashTotalSpent');
    const remaining = document.getElementById('dashRemaining');
    const burnPercent = document.getElementById('dashBurnPercent');
    const burnBar = document.getElementById('dashBurnBar');

    if (totalIncome) totalIncome.textContent = `$${b.totalIncome.toLocaleString()}`;
    if (allocated) allocated.textContent = `$${b.totalAllocated.toLocaleString()}`;
    if (unallocated) unallocated.textContent = `$${b.unallocated.toLocaleString()} unallocated cushion`;
    if (totalSpent) totalSpent.textContent = `$${b.totalSpent.toLocaleString()}`;
    if (remaining) remaining.textContent = `$${b.totalRemaining.toLocaleString()} remaining`;

    if (burnPercent) burnPercent.textContent = `${b.overallBurnPercent}% Spent`;
    if (burnBar) {
      burnBar.style.width = `${Math.min(b.overallBurnPercent, 100)}%`;
      burnBar.className = `progress-fill ${b.overallBurnPercent > 85 ? 'warning' : 'healthy'}`;
    }

    // Recent Transactions Ledger
    const recentList = document.getElementById('dashRecentExpenses');
    if (recentList && s && s.recentExpenses) {
      recentList.innerHTML = s.recentExpenses.map(exp => {
        const cat = b.categories.find(c => c.id === exp.categoryId) || { icon: '💳', name: 'General', color: '#818cf8' };
        const isSplit = exp.isSplit;
        const splitBadge = isSplit ? `<span class="category-badge badge-variable" style="font-size: 0.7rem; margin-left: 8px;">👥 Split</span>` : '';

        const dateStr = new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return `
          <div class="transaction-item">
            <div class="trans-left">
              <div class="trans-icon" style="background: ${cat.color}22; padding: 6px 10px; border-radius: 8px;">${cat.icon}</div>
              <div>
                <div class="trans-title">${exp.title} ${splitBadge}</div>
                <div class="trans-meta">${cat.name} • ${dateStr}</div>
              </div>
            </div>
            <div class="trans-amount" style="color: ${isSplit ? '#6ee7b7' : '#fff'};">
              $${exp.amount.toFixed(2)}
            </div>
          </div>
        `;
      }).join('');
    }
  },

  populateCategorySelect() {
    const sel = document.getElementById('expCategory');
    if (!sel || !this.state.budget) return;

    sel.innerHTML = this.state.budget.categories.map(c => 
      `<option value="${c.id}">${c.icon} ${c.name}</option>`
    ).join('');
  },

  setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  },

  switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tabId}`);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openAddExpenseModal(precheckSplit = false) {
    const modal = document.getElementById('addExpenseModal');
    const isSplitCheckbox = document.getElementById('expIsSplit');
    if (modal) modal.classList.add('open');
    if (isSplitCheckbox) {
      isSplitCheckbox.checked = precheckSplit;
      splitView.toggleSplitFields(precheckSplit);
    }
  },

  openSettleModal() {
    const modal = document.getElementById('settleModal');
    if (modal) modal.classList.add('open');
  },

  openAddCategoryModal() {
    const modal = document.getElementById('addCategoryModal');
    if (modal) modal.classList.add('open');
  },

  closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  },

  async submitExpense(e) {
    e.preventDefault();
    const title = document.getElementById('expTitle').value;
    const amount = Number(document.getElementById('expAmount').value);
    const categoryId = document.getElementById('expCategory').value;
    const isSplit = document.getElementById('expIsSplit').checked;
    const groupId = document.getElementById('expGroup').value || null;
    const splitType = document.getElementById('expSplitType').value || 'EQUAL';

    let participants = [];
    if (isSplit) {
      const checkedBoxes = document.querySelectorAll('input[name="participant"]:checked');
      participants = ['user-me']; // Always includes current user
      checkedBoxes.forEach(cb => participants.push(cb.value));
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          amount,
          categoryId,
          isSplit,
          groupId,
          splitType,
          participants
        })
      });

      const data = await res.json();
      if (data.success) {
        this.showToast(`✅ Expense "${title}" ($${amount}) added!`);
        this.closeModals();
        document.getElementById('expenseForm').reset();
        await this.refreshAll();
      } else {
        this.showToast('❌ Error: ' + data.error);
      }
    } catch (err) {
      this.showToast('❌ Network error adding expense');
    }
  },

  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

// Initialize application on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
