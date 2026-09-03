// Budget View Module
const budgetView = {
  categories: [],
  totalIncome: 0,
  targetSavings: 0,

  init(budgetData) {
    this.categories = budgetData.categories || [];
    this.totalIncome = budgetData.totalIncome || 0;
    this.targetSavings = budgetData.targetSavings || 0;

    const incomeInput = document.getElementById('allocIncomeInput');
    const targetInput = document.getElementById('allocTargetInput');
    if (incomeInput) incomeInput.value = this.totalIncome;
    if (targetInput) targetInput.value = this.targetSavings;

    this.renderCategoryCards();
    this.recalculatePool();
  },

  renderCategoryCards() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;

    grid.innerHTML = this.categories.map(cat => {
      const isFixed = Boolean(cat.isFixed);
      const badgeClass = isFixed ? 'badge-fixed' : 'badge-variable';
      const badgeLabel = isFixed ? `Fixed (Due ${cat.dueDay || 1}st)` : 'Variable Spend';
      const progressClass = cat.status === 'CRITICAL' ? 'critical' : cat.status === 'WARNING' ? 'warning' : 'healthy';

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
              <span style="font-size: 0.8rem; font-weight: 600; color: ${cat.status === 'CRITICAL' ? '#ef4444' : cat.status === 'WARNING' ? '#f59e0b' : '#10b981'};">
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
              <span class="category-spent">$${cat.spent.toLocaleString()}</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">ALLOCATED</span>
              <span class="category-allocated" id="allocVal-${cat.id}">$${cat.allocated.toLocaleString()}</span>
            </div>
          </div>

          <div class="slider-group" style="margin-top: 6px;">
            <label style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span>Adjust Month Budget:</span>
              <strong id="sliderLabel-${cat.id}" style="color: #c7d2fe;">$${cat.allocated}</strong>
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
    }).join('');
  },

  onSliderChange(catId, newValue) {
    const val = Number(newValue);
    const cat = this.categories.find(c => c.id === catId);
    if (cat) {
      cat.allocated = val;
      const label = document.getElementById(`sliderLabel-${catId}`);
      const allocVal = document.getElementById(`allocVal-${catId}`);
      if (label) label.textContent = `$${val.toLocaleString()}`;
      if (allocVal) allocVal.textContent = `$${val.toLocaleString()}`;
    }
    this.recalculatePool();
  },

  recalculatePool() {
    const incomeInput = document.getElementById('allocIncomeInput');
    const targetInput = document.getElementById('allocTargetInput');
    const cushionDisplay = document.getElementById('allocCushionDisplay');
    const poolStatus = document.getElementById('allocPoolStatus');
    const poolBar = document.getElementById('allocPoolBar');

    const totalIncome = Number(incomeInput ? incomeInput.value : this.totalIncome) || 0;
    const targetSavings = Number(targetInput ? targetInput.value : this.targetSavings) || 0;

    let totalAllocated = 0;
    this.categories.forEach(c => {
      totalAllocated += Number(c.allocated) || 0;
    });

    const totalCommitted = totalAllocated + targetSavings;
    const cushion = totalIncome - totalCommitted;

    if (cushionDisplay) {
      cushionDisplay.textContent = `${cushion >= 0 ? '$' : '-$'}${Math.abs(cushion).toLocaleString()}`;
      cushionDisplay.style.color = cushion >= 0 ? '#10b981' : '#ef4444';
    }

    const commitPct = totalIncome > 0 ? Math.round((totalCommitted / totalIncome) * 100) : 0;
    if (poolStatus) {
      poolStatus.textContent = `${commitPct}% of income committed (${cushion >= 0 ? '$' + cushion + ' cushion' : 'Over-budget by $' + Math.abs(cushion)})`;
    }

    if (poolBar) {
      poolBar.style.width = `${Math.min(commitPct, 100)}%`;
      poolBar.className = `progress-fill ${cushion >= 0 ? 'healthy' : 'critical'}`;
    }
  },

  async saveAllocations() {
    const incomeInput = document.getElementById('allocIncomeInput');
    const targetInput = document.getElementById('allocTargetInput');

    const totalIncome = Number(incomeInput ? incomeInput.value : this.totalIncome);
    const targetSavings = Number(targetInput ? targetInput.value : this.targetSavings);

    const payload = {
      totalIncome,
      targetSavings,
      allocations: this.categories.map(c => ({ id: c.id, allocated: c.allocated }))
    };

    try {
      const res = await fetch('/api/budget/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        app.showToast('✅ Monthly allocations successfully saved!');
        app.refreshAll();
      } else {
        app.showToast('❌ Failed to save allocations: ' + data.error);
      }
    } catch (err) {
      app.showToast('❌ Network error saving budget');
    }
  },

  async submitNewCategory(e) {
    e.preventDefault();
    const name = document.getElementById('catNameInput').value;
    const icon = document.getElementById('catIconInput').value || '🏷️';
    const allocated = Number(document.getElementById('catAllocInput').value) || 0;
    const isFixed = document.getElementById('catIsFixedInput').checked;

    try {
      const res = await fetch('/api/budget/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, allocated, isFixed })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ Created category: ${icon} ${name}`);
        app.closeModals();
        app.refreshAll();
      }
    } catch (err) {
      app.showToast('❌ Error creating category');
    }
  }
};
