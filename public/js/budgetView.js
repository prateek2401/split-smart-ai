// Budget View Module - Multi-Month Allocations & Seasonal Payments
const budgetView = {
  categories: [],
  seasonalPayments: [],
  totalIncome: 0,
  targetSavings: 0,
  month: "2026-09",

  init(budgetData) {
    if (!budgetData) return;
    this.categories = budgetData.categories || [];
    this.seasonalPayments = budgetData.seasonalPayments || [];
    this.totalIncome = budgetData.totalIncome || 0;
    this.targetSavings = budgetData.targetSavings || 0;
    this.month = budgetData.month || "2026-09";

    const incomeInput = document.getElementById("allocIncomeInput");
    const targetInput = document.getElementById("allocTargetInput");
    const monthDisplay = document.getElementById("allocatorMonthDisplay");

    if (incomeInput) incomeInput.value = this.totalIncome;
    if (targetInput) targetInput.value = this.targetSavings;
    if (monthDisplay) {
      const parts = this.month.split("-");
      const d = new Date(parts[0], parts[1] - 1);
      monthDisplay.textContent = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    this.renderSeasonalPayments();
    this.renderCategoryCards();
    this.recalculatePool();
  },

  renderSeasonalPayments() {
    const list = document.getElementById("seasonalPaymentsList");
    if (!list) return;

    if (!this.seasonalPayments || this.seasonalPayments.length === 0) {
      list.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); border: 1px dashed var(--border-color);">
          No seasonal commitments for this month. (Click "+ Add Seasonal Bill" to add annual insurance, taxes, or one-off dues).
        </div>
      `;
      return;
    }

    list.innerHTML = this.seasonalPayments.map(s => `
      <div class="seasonal-card">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="font-size: 26px; background: rgba(236, 72, 153, 0.15); width: 44px; height: 44px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;">
            ${s.icon || "🛡️"}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-size: 0.95rem; color: #fff;">${s.title}</span>
              <span class="category-badge badge-fixed" style="font-size: 0.7rem;">Due in ${s.appliesToMonth}</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
              Month-Specific Seasonal Commitment • Reserves funds from spending pool
            </div>
          </div>
        </div>

        <div style="text-align: right;">
          <div style="font-size: 1.25rem; font-weight: 800; color: #ec4899; font-family: 'Outfit';">
            ${app.formatMoney(s.amount)}
          </div>
          <span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">Active in Budget</span>
        </div>
      </div>
    `).join("");
  },

  renderCategoryCards() {
    const grid = document.getElementById("categoriesGrid");
    if (!grid) return;

    grid.innerHTML = this.categories.map(cat => {
      const isFixed = Boolean(cat.isFixed);
      const badgeClass = isFixed ? "badge-fixed" : "badge-variable";
      const badgeLabel = isFixed ? `Fixed (Due ${cat.dueDay || 1}st)` : "Variable Spend";
      const progressClass = cat.status === "CRITICAL" ? "critical" : cat.status === "WARNING" ? "warning" : "healthy";

      return `
        <div class="category-card" data-cat-id="${cat.id}">
          <div class="category-header">
            <div class="category-identity">
              <div class="category-icon" style="background: ${cat.color}22; color: ${cat.color};">
                ${cat.icon}
              </div>
              <div>
                <div class="category-name">${cat.name}</div>
                <span class="category-badge ${badgeClass}">${badgeLabel}</span>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.8rem; font-weight: 600; color: ${cat.status === "CRITICAL" ? "#ef4444" : cat.status === "WARNING" ? "#f59e0b" : "#10b981"};">
                ${cat.percentage}%
              </span>
            </div>
          </div>

          <div class="progress-bar-container">
            <div class="progress-track">
              <div class="progress-fill ${progressClass}" style="width: ${Math.min(cat.percentage, 100)}%;"></div>
            </div>
          </div>

          <div class="category-figures">
            <div>
              <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">SPENT</span>
              <span class="category-spent">${app.formatMoney(cat.spent)}</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">ALLOCATED</span>
              <span class="category-allocated" id="allocVal-${cat.id}">${app.formatMoney(cat.allocated)}</span>
            </div>
          </div>

          <div class="slider-group" style="margin-top: 6px;">
            <label style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span>Adjust Month Budget:</span>
              <strong id="sliderLabel-${cat.id}" style="color: #c7d2fe;">${app.formatMoney(cat.allocated)}</strong>
            </label>
            <input type="range" 
              min="0" 
              max="${Math.max(cat.allocated * 2, 2000)}" 
              step="25" 
              value="${cat.allocated}" 
              class="range-slider" 
              oninput="budgetView.onSliderChange('${cat.id}', this.value)"
            >
          </div>
        </div>
      `;
    }).join("");
  },

  onSliderChange(catId, newValue) {
    const val = Number(newValue);
    const cat = this.categories.find(c => c.id === catId);
    if (cat) {
      cat.allocated = val;
      const label = document.getElementById(`sliderLabel-${catId}`);
      const allocVal = document.getElementById(`allocVal-${catId}`);
      if (label) label.textContent = app.formatMoney(val);
      if (allocVal) allocVal.textContent = app.formatMoney(val);
    }
    this.recalculatePool();
  },

  recalculatePool() {
    const incomeInput = document.getElementById("allocIncomeInput");
    const targetInput = document.getElementById("allocTargetInput");
    const cushionDisplay = document.getElementById("allocCushionDisplay");
    const poolStatus = document.getElementById("allocPoolStatus");
    const poolBar = document.getElementById("allocPoolBar");

    const totalIncome = Number(incomeInput ? incomeInput.value : this.totalIncome) || 0;
    const targetSavings = Number(targetInput ? targetInput.value : this.targetSavings) || 0;

    let totalAllocated = 0;
    this.categories.forEach(c => {
      totalAllocated += Number(c.allocated) || 0;
    });

    let seasonalTotal = 0;
    (this.seasonalPayments || []).forEach(s => {
      seasonalTotal += Number(s.amount) || 0;
    });

    const totalCommitted = totalAllocated + targetSavings + seasonalTotal;
    const cushion = totalIncome - totalCommitted;

    if (cushionDisplay) {
      cushionDisplay.textContent = app.formatMoney(cushion);
      cushionDisplay.style.color = cushion >= 0 ? "#10b981" : "#ef4444";
    }

    const commitPct = totalIncome > 0 ? Math.round((totalCommitted / totalIncome) * 100) : 0;
    if (poolStatus) {
      poolStatus.textContent = `${commitPct}% of income committed (${cushion >= 0 ? app.formatMoney(cushion) + " cushion" : "Over-budget by " + app.formatMoney(Math.abs(cushion))})`;
    }

    if (poolBar) {
      poolBar.style.width = `${Math.min(commitPct, 100)}%`;
      poolBar.className = `progress-fill ${cushion >= 0 ? "healthy" : "critical"}`;
    }
  },

  async saveAllocations() {
    const incomeInput = document.getElementById("allocIncomeInput");
    const targetInput = document.getElementById("allocTargetInput");

    const totalIncome = Number(incomeInput ? incomeInput.value : this.totalIncome);
    const targetSavings = Number(targetInput ? targetInput.value : this.targetSavings);

    const payload = {
      month: app.activeMonth,
      totalIncome,
      targetSavings,
      allocations: this.categories.map(c => ({ id: c.id, allocated: c.allocated }))
    };

    try {
      const res = await fetch("/api/budget/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ Monthly allocations for ${app.activeMonth} successfully saved!`);
        await app.refreshAll();
      } else {
        app.showToast("❌ Failed to save allocations: " + data.error);
      }
    } catch (err) {
      app.showToast("❌ Network error saving budget");
    }
  },

  async submitCopyBudget(e) {
    e.preventDefault();
    const fromMonth = document.getElementById("copyFromMonth").value;
    const toMonth = document.getElementById("copyToMonth").value;

    try {
      const res = await fetch("/api/budget/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromMonth, toMonth })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ Copied budget from ${fromMonth} to ${toMonth}!`);
        app.closeModals();
        app.switchMonth(toMonth);
      } else {
        app.showToast("❌ Error: " + data.error);
      }
    } catch (err) {
      app.showToast("❌ Network error duplicating budget");
    }
  },

  async submitSeasonalPayment(e) {
    e.preventDefault();
    const title = document.getElementById("seasonalTitleInput").value;
    const amount = Number(document.getElementById("seasonalAmountInput").value);
    const appliesToMonth = document.getElementById("seasonalMonthInput").value;
    const icon = document.getElementById("seasonalIconInput").value || "🛡️";
    const categoryId = document.getElementById("seasonalCategoryInput").value;

    try {
      const res = await fetch("/api/budget/seasonal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, amount, appliesToMonth, icon, categoryId })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ Added seasonal commitment: ${title} (${app.formatMoney(amount)})`);
        app.closeModals();
        if (app.activeMonth !== appliesToMonth) {
          app.switchMonth(appliesToMonth);
        } else {
          await app.refreshAll();
        }
      } else {
        app.showToast("❌ Error: " + data.error);
      }
    } catch (err) {
      app.showToast("❌ Network error adding seasonal payment");
    }
  },

  async submitNewCategory(e) {
    e.preventDefault();
    const name = document.getElementById("catNameInput").value;
    const icon = document.getElementById("catIconInput").value || "🏷️";
    const allocated = Number(document.getElementById("catAllocInput").value) || 0;
    const isFixed = document.getElementById("catIsFixedInput").checked;

    try {
      const res = await fetch("/api/budget/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon, allocated, isFixed, month: app.activeMonth })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ Created category: ${icon} ${name}`);
        app.closeModals();
        await app.refreshAll();
      }
    } catch (err) {
      app.showToast("❌ Error creating category");
    }
  }
};
