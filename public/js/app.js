// Main Application Controller - Auth Gate, Multi-Month & Currency Engine
const app = {
  activeMonth: "2026-09",
  currency: "$",
  currencyCode: "USD",
  selectedCurrencyTemp: { symbol: "$", code: "USD" },
  currentUser: null,
  authMode: "login",
  isLoggedIn: false,

  state: {
    budget: null,
    splitwise: null,
    ai: null
  },

  async init() {
    this.setupNavigation();
    this.checkAuthGate();
  },

  checkAuthGate() {
    const authStored = localStorage.getItem("splitsmart_logged_in");
    const userStored = localStorage.getItem("splitsmart_user");

    if (authStored === "true" && userStored) {
      try {
        this.currentUser = JSON.parse(userStored);
        this.isLoggedIn = true;
        this.showApp();
        this.refreshAll();
      } catch (e) {
        this.showAuthPage();
      }
    } else {
      this.showAuthPage();
    }
  },

  showAuthPage() {
    this.isLoggedIn = false;
    const authEl = document.getElementById("authPage");
    const appEl = document.getElementById("appContainer");
    if (authEl) authEl.style.display = "flex";
    if (appEl) appEl.style.display = "none";
  },

  showApp() {
    this.isLoggedIn = true;
    const authEl = document.getElementById("authPage");
    const appEl = document.getElementById("appContainer");
    if (authEl) authEl.style.display = "none";
    if (appEl) appEl.style.display = "block";
  },

  logout() {
    localStorage.removeItem("splitsmart_logged_in");
    localStorage.removeItem("splitsmart_user");
    this.currentUser = null;
    this.showAuthPage();
    this.showToast("🚪 Logged out successfully");
  },

  formatMoney(amount) {
    const num = Number(amount) || 0;
    const isNegative = num < 0;
    const absVal = Math.abs(num);

    let formattedNum;
    if (this.currencyCode === "INR" || this.currency === "₹") {
      formattedNum = absVal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } else {
      formattedNum = absVal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    return `${isNegative ? "-" : ""}${this.currency}${formattedNum}`;
  },

  async refreshAll() {
    if (!this.isLoggedIn) return;
    try {
      const [budgetRes, splitRes, aiRes] = await Promise.all([
        fetch(`/api/budget?month=${this.activeMonth}`).then(r => r.json()),
        fetch("/api/splitwise").then(r => r.json()),
        fetch("/api/ai/predict").then(r => r.json())
      ]);

      if (budgetRes.success) {
        this.state.budget = budgetRes.data;
        if (budgetRes.data.currency) this.currency = budgetRes.data.currency;
        if (budgetRes.data.currencyCode) this.currencyCode = budgetRes.data.currencyCode;
      }
      if (splitRes.success) {
        this.state.splitwise = splitRes.data;
        if (!this.currentUser && splitRes.data.currentUser) {
          this.currentUser = splitRes.data.currentUser;
        }
      }
      if (aiRes.success) this.state.ai = aiRes.data;

      this.updateHeaderUserProfile();
      this.updateCurrencyLabels();
      this.renderDashboard();
      budgetView.init(this.state.budget);
      splitView.init(this.state.splitwise);
      aiView.init(this.state.ai);
      if (typeof bankView !== "undefined") await bankView.init();
      this.populateCategorySelect();
    } catch (err) {
      console.error("Failed to load application data:", err);
      this.showToast("❌ Error loading data from server");
    }
  },

  updateHeaderUserProfile() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById("userName");
    const avatarEl = document.getElementById("userAvatar");
    const badgeEl = document.getElementById("currentCurrencyBadge");

    if (nameEl) nameEl.textContent = this.currentUser.name;
    if (avatarEl && this.currentUser.avatar) avatarEl.src = this.currentUser.avatar;
    if (badgeEl) badgeEl.textContent = `${this.currency} ${this.currencyCode}`;

    const iconEl = document.getElementById("currencySymbolIcon");
    if (iconEl) {
      const icons = { "$": "💵", "₹": "🇮🇳", "€": "💶", "£": "💷" };
      iconEl.textContent = icons[this.currency] || "💵";
    }
  },

  updateCurrencyLabels() {
    document.querySelectorAll(".currency-label").forEach(el => {
      el.textContent = this.currency;
    });
  },

  async switchMonth(newMonth) {
    this.activeMonth = newMonth;
    const select = document.getElementById("headerMonthSelect");
    if (select) select.value = newMonth;
    this.showToast(`📅 Switched to ${newMonth}`);
    await this.refreshAll();
  },

  renderDashboard() {
    const b = this.state.budget;
    const s = this.state.splitwise;
    if (!b) return;

    const totalIncome = document.getElementById("dashTotalIncome");
    const allocated = document.getElementById("dashAllocated");
    const unallocated = document.getElementById("dashUnallocated");
    const totalSpent = document.getElementById("dashTotalSpent");
    const remaining = document.getElementById("dashRemaining");
    const burnPercent = document.getElementById("dashBurnPercent");
    const burnBar = document.getElementById("dashBurnBar");
    const monthLabel = document.getElementById("dashActiveMonthLabel");

    if (totalIncome) totalIncome.textContent = this.formatMoney(b.totalIncome);
    if (allocated) allocated.textContent = this.formatMoney(b.totalAllocated);
    if (unallocated) unallocated.textContent = `${this.formatMoney(b.unallocated)} unallocated cushion`;
    if (totalSpent) totalSpent.textContent = this.formatMoney(b.totalSpent);
    if (remaining) remaining.textContent = `${this.formatMoney(b.totalRemaining)} remaining`;
    if (monthLabel) monthLabel.textContent = `Active pool (${this.activeMonth})`;

    if (burnPercent) burnPercent.textContent = `${b.overallBurnPercent}% Spent`;
    if (burnBar) {
      burnBar.style.width = `${Math.min(b.overallBurnPercent, 100)}%`;
      burnBar.className = `progress-fill ${b.overallBurnPercent > 85 ? "warning" : "healthy"}`;
    }

    const dashOwed = document.getElementById("dashOwedAmount");
    const dashOwe = document.getElementById("dashOweAmount");
    if (dashOwed && s) dashOwed.textContent = this.formatMoney(s.totalYouAreOwed);
    if (dashOwe && s) dashOwe.textContent = this.formatMoney(s.totalYouOwe);

    const recentList = document.getElementById("dashRecentExpenses");
    if (recentList && s && s.recentExpenses) {
      recentList.innerHTML = s.recentExpenses.map(exp => {
        const cat = b.categories.find(c => c.id === exp.categoryId) || { icon: "💳", name: "General", color: "#818cf8" };
        const isSplit = exp.isSplit;
        const splitBadge = isSplit ? `<span class="category-badge badge-variable" style="font-size: 0.7rem; margin-left: 8px;">👥 Split</span>` : "";
        const dateStr = new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

        return `
          <div class="transaction-item">
            <div class="trans-left">
              <div class="trans-icon" style="background: ${cat.color}22; padding: 6px 10px; border-radius: 8px;">${cat.icon}</div>
              <div>
                <div class="trans-title">${exp.title} ${splitBadge}</div>
                <div class="trans-meta">${cat.name} • ${dateStr}</div>
              </div>
            </div>
            <div class="trans-amount" style="color: ${isSplit ? "#6ee7b7" : "#fff"};">
              ${this.formatMoney(exp.amount)}
            </div>
          </div>
        `;
      }).join("");
    }
  },

  populateCategorySelect() {
    const sel = document.getElementById("expCategory");
    if (!sel || !this.state.budget) return;

    sel.innerHTML = this.state.budget.categories.map(c => 
      `<option value="${c.id}">${c.icon} ${c.name}</option>`
    ).join("");
  },

  setupNavigation() {
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const targetTab = tab.getAttribute("data-tab");
        this.switchTab(targetTab);
      });
    });
  },

  switchTab(tabId) {
    document.querySelectorAll(".nav-tab").forEach(t => {
      t.classList.toggle("active", t.getAttribute("data-tab") === tabId);
    });

    document.querySelectorAll(".tab-pane").forEach(p => {
      p.classList.toggle("active", p.id === `tab-${tabId}`);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  // Currency Selection Handling
  openCurrencyModal() {
    this.selectedCurrencyTemp = { symbol: this.currency, code: this.currencyCode };
    document.querySelectorAll(".currency-card").forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-curr") === this.currency);
    });
    const modal = document.getElementById("currencyModal");
    if (modal) modal.classList.add("open");
  },

  selectCurrencyCard(symbol, code, element) {
    this.selectedCurrencyTemp = { symbol, code };
    document.querySelectorAll(".currency-card").forEach(c => c.classList.remove("active"));
    if (element) element.classList.add("active");
  },

  async saveSelectedCurrency() {
    const { symbol, code } = this.selectedCurrencyTemp;
    try {
      const res = await fetch("/api/user/currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: symbol, currencyCode: code })
      });
      const data = await res.json();
      if (data.success) {
        this.currency = symbol;
        this.currencyCode = code;
        this.showToast(`💱 Currency updated to ${symbol} (${code})`);
        this.closeModals();
        await this.refreshAll();
      }
    } catch (err) {
      this.showToast("❌ Error updating currency");
    }
  },

  // Auth Functions
  switchAuthTab(mode) {
    this.authMode = mode;
    const nameGroup = document.getElementById("authNameGroup");
    const currGroup = document.getElementById("authCurrencyGroup");
    const submitBtn = document.getElementById("authSubmitBtn");
    const tabLogin = document.getElementById("authTabLogin");
    const tabRegister = document.getElementById("authTabRegister");
    const title = document.getElementById("authPanelTitle");
    const subtitle = document.getElementById("authPanelSubtitle");

    if (mode === "register") {
      if (nameGroup) nameGroup.style.display = "block";
      if (currGroup) currGroup.style.display = "block";
      if (title) title.textContent = "Create New Account";
      if (subtitle) subtitle.textContent = "Join SplitSmart AI to manage your monthly finances and shared bills.";
      if (submitBtn) submitBtn.textContent = "Create Free Account";
      if (tabRegister) {
        tabRegister.style.background = "rgba(99, 102, 241, 0.2)";
        tabRegister.style.borderColor = "#6366f1";
      }
      if (tabLogin) {
        tabLogin.style.background = "";
        tabLogin.style.borderColor = "";
      }
    } else {
      if (nameGroup) nameGroup.style.display = "none";
      if (currGroup) currGroup.style.display = "none";
      if (title) title.textContent = "Welcome to SplitSmart AI";
      if (subtitle) subtitle.textContent = "Sign in with Google SSO or your email to access your financial desk.";
      if (submitBtn) submitBtn.textContent = "Sign In to Dashboard";
      if (tabLogin) {
        tabLogin.style.background = "rgba(99, 102, 241, 0.2)";
        tabLogin.style.borderColor = "#6366f1";
      }
      if (tabRegister) {
        tabRegister.style.background = "";
        tabRegister.style.borderColor = "";
      }
    }
  },

  tempGoogleAccount: null,

  handleGoogleSSO() {
    // Open realistic Google Account Chooser popup
    const modal = document.getElementById("googleAccountModal");
    const chooser = document.getElementById("googleChooserScreen");
    const consent = document.getElementById("googleConsentScreen");
    const customArea = document.getElementById("customGoogleInputArea");

    if (chooser) chooser.style.display = "block";
    if (consent) consent.style.display = "none";
    if (customArea) customArea.style.display = "none";
    if (modal) modal.classList.add("open");
  },

  closeGoogleModal() {
    const modal = document.getElementById("googleAccountModal");
    if (modal) modal.classList.remove("open");
  },

  pickGoogleAccount(email, name, avatar) {
    this.tempGoogleAccount = { email, name, avatar };
    const chooser = document.getElementById("googleChooserScreen");
    const consent = document.getElementById("googleConsentScreen");
    const badge = document.getElementById("consentAccountBadge");

    if (badge) badge.textContent = `Signed in as ${email}`;
    if (chooser) chooser.style.display = "none";
    if (consent) consent.style.display = "block";
  },

  toggleCustomGoogleInput() {
    const area = document.getElementById("customGoogleInputArea");
    if (area) {
      area.style.display = area.style.display === "none" ? "block" : "none";
    }
  },

  submitCustomGoogleAccount() {
    const email = document.getElementById("customGoogleEmail")?.value?.trim();
    const name = document.getElementById("customGoogleName")?.value?.trim() || "Google User";
    if (!email || !email.includes("@")) {
      this.showToast("❌ Please enter a valid Gmail address");
      return;
    }
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;
    this.pickGoogleAccount(email, name, avatar);
  },

  backToGoogleChooser() {
    const chooser = document.getElementById("googleChooserScreen");
    const consent = document.getElementById("googleConsentScreen");
    if (chooser) chooser.style.display = "block";
    if (consent) consent.style.display = "none";
  },

  async confirmGoogleLogin() {
    if (!this.tempGoogleAccount) return;
    try {
      const res = await fetch("/api/auth/google-sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.tempGoogleAccount)
      });
      const data = await res.json();
      if (data.success) {
        this.closeGoogleModal();
        this.loginSuccess(data.data, `Signed in with Google as ${data.data.name}!`);
      } else {
        this.showToast("❌ " + data.error);
      }
    } catch (err) {
      this.showToast("❌ Google sign-in failed");
    }
  },

  async handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("authEmailInput").value;
    const password = document.getElementById("authPasswordInput").value;
    const name = document.getElementById("authNameInput")?.value || "";

    const currVal = document.getElementById("authCurrencySelect")?.value || "$:USD";
    const [currSymbol, currCode] = currVal.split(":");

    const endpoint = this.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload = this.authMode === "register" ? { name, email, password, currency: currSymbol, currencyCode: currCode } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.loginSuccess(data.data, this.authMode === "register" ? "Account created successfully!" : "Signed in successfully!");
      } else {
        this.showToast("❌ " + data.error);
      }
    } catch (err) {
      this.showToast("❌ Authentication error");
    }
  },

  quickDemoLogin() {
    const demoUser = {
      id: "user-me",
      name: "Prateek (You)",
      email: "prateek@example.com",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Prateek",
      currency: this.currency,
      currencyCode: this.currencyCode
    };
    this.loginSuccess(demoUser, "Welcome back, Prateek!");
  },

  loginSuccess(user, message) {
    this.currentUser = user;
    localStorage.setItem("splitsmart_logged_in", "true");
    localStorage.setItem("splitsmart_user", JSON.stringify(user));
    if (user.currency) this.currency = user.currency;
    if (user.currencyCode) this.currencyCode = user.currencyCode;

    this.showApp();
    this.showToast(`✅ ${message}`);
    this.refreshAll();

    // Auto-launch quick guided tour on first login
    if (localStorage.getItem("splitsmart_tour_completed") !== "true") {
      setTimeout(() => {
        if (typeof tourView !== "undefined") tourView.startTour();
      }, 700);
    }
  },

  openCopyBudgetModal() {
    const fromSelect = document.getElementById("copyFromMonth");
    const toSelect = document.getElementById("copyToMonth");
    if (fromSelect) fromSelect.value = this.activeMonth;
    if (toSelect) toSelect.value = this.activeMonth === "2026-09" ? "2026-10" : "2026-11";

    const modal = document.getElementById("copyBudgetModal");
    if (modal) modal.classList.add("open");
  },

  openSeasonalModal() {
    const modal = document.getElementById("seasonalModal");
    if (modal) modal.classList.add("open");
  },

  openAddExpenseModal(precheckSplit = false) {
    const modal = document.getElementById("addExpenseModal");
    const isSplitCheckbox = document.getElementById("expIsSplit");
    if (modal) modal.classList.add("open");
    if (isSplitCheckbox) {
      isSplitCheckbox.checked = precheckSplit;
      splitView.toggleSplitFields(precheckSplit);
    }
  },

  openSettleModal() {
    const modal = document.getElementById("settleModal");
    if (modal) modal.classList.add("open");
  },

  openAddCategoryModal() {
    const modal = document.getElementById("addCategoryModal");
    if (modal) modal.classList.add("open");
  },

  closeModals() {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("open"));
  },

  async submitExpense(e) {
    e.preventDefault();
    const title = document.getElementById("expTitle").value;
    const amount = Number(document.getElementById("expAmount").value);
    const categoryId = document.getElementById("expCategory").value;
    const isSplit = document.getElementById("expIsSplit").checked;
    const groupId = document.getElementById("expGroup").value || null;
    const splitType = document.getElementById("expSplitType").value || "EQUAL";

    let participants = [];
    if (isSplit) {
      const checkedBoxes = document.querySelectorAll('input[name="participant"]:checked');
      participants = ["user-me"];
      checkedBoxes.forEach(cb => participants.push(cb.value));
    }

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        this.showToast(`✅ Expense "${title}" (${this.formatMoney(amount)}) added!`);
        this.closeModals();
        document.getElementById("expenseForm").reset();
        await this.refreshAll();
      } else {
        this.showToast("❌ Error: " + data.error);
      }
    } catch (err) {
      this.showToast("❌ Network error adding expense");
    }
  },

  showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
