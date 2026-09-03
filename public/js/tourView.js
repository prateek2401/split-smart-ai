// Interactive Product Tour Module
const tourView = {
  currentStep: 0,
  steps: [
    {
      badge: "Step 1 of 5 • Command Center",
      icon: "📊",
      title: "Welcome to SplitSmart AI",
      tab: "dashboard",
      description: "This is your Overview Dashboard. Get an instant, unified pulse of your monthly paycheck, total budget allocated, actual spending so far, and your AI-projected savings trajectory.",
      tip: "💡 Tip: Check your budget burn pace bar in the center to ensure you aren't spending too fast early in the month."
    },
    {
      badge: "Step 2 of 5 • Proactive Planning",
      icon: "🎯",
      title: "Start-of-Month Budget Allocator",
      tab: "allocator",
      description: "Allocate your salary before the month begins! Adjust sliders for fixed costs (Rent, EMI, Utilities) and variable pools (Groceries, Fuel, Dining). An unallocated safety cushion is calculated in real-time.",
      tip: "💡 Tip: Use '📋 Copy to Month' to duplicate your budget to next month, and '🛡️ Add Insurance' for seasonal commitments."
    },
    {
      badge: "Step 3 of 5 • Shared Expenses",
      icon: "👥",
      title: "Splitwise Hub & Debt Simplification",
      tab: "splitwise",
      description: "Split group bills with roommates and friends with zero math. When you log a shared expense, only your share affects your personal budget—roommate shares are recorded as incoming receivables.",
      tip: "💡 Tip: Our algorithm automatically simplifies multi-person debts into the absolute minimum number of settlement payments."
    },
    {
      badge: "Step 4 of 5 • Financial Intelligence",
      icon: "🤖",
      title: "AI Savings & Wealth Predictor",
      tab: "ai-predictions",
      description: "Our predictive math model calculates your daily variable burn velocity ($/day), flags leaking categories early, and forecasts your 12-month net wealth accumulation with 7% compound growth.",
      tip: "💡 Tip: Drag the 'AI What-If Scenario Simulator' slider to see how trimming discretionary dining compounds into thousands in wealth!"
    },
    {
      badge: "Step 5 of 5 • Automation & Currency",
      icon: "🏦",
      title: "Bank Sync & Multi-Currency",
      tab: "dashboard",
      description: "Experience automated bank debit webhooks! When rent or bills are paid, SplitSmart AI prompts you with a 1-click button to split with flatmates and pushes broadcast alerts. You can also switch currency ($ USD, ₹ INR, € EUR, £ GBP) anytime.",
      tip: "💡 Tip: Click '🏦 Simulate Bank Pay' in the header anytime to test the automated bank detection webhook."
    }
  ],

  startTour() {
    this.currentStep = 0;
    const modal = document.getElementById("guideTourModal");
    if (modal) modal.classList.add("open");
    this.renderStep();
  },

  renderStep() {
    const s = this.steps[this.currentStep];
    if (!s) return;

    // Switch tab to let user see the feature in action
    if (s.tab && typeof app !== "undefined") {
      app.switchTab(s.tab);
    }

    const badgeEl = document.getElementById("tourStepBadge");
    const titleEl = document.getElementById("tourStepTitle");
    const descEl = document.getElementById("tourStepDesc");
    const tipEl = document.getElementById("tourStepTip");
    const nextBtn = document.getElementById("tourNextBtn");
    const prevBtn = document.getElementById("tourPrevBtn");
    const dotsContainer = document.getElementById("tourProgressDots");

    if (badgeEl) badgeEl.textContent = s.badge;
    if (titleEl) titleEl.innerHTML = `<span>${s.icon}</span> <span>${s.title}</span>`;
    if (descEl) descEl.textContent = s.description;
    if (tipEl) tipEl.textContent = s.tip;

    if (prevBtn) {
      prevBtn.style.visibility = this.currentStep === 0 ? "hidden" : "visible";
    }

    if (nextBtn) {
      if (this.currentStep === this.steps.length - 1) {
        nextBtn.textContent = "Get Started 🚀";
        nextBtn.className = "btn btn-success";
      } else {
        nextBtn.textContent = "Next Feature →";
        nextBtn.className = "btn btn-primary";
      }
    }

    if (dotsContainer) {
      dotsContainer.innerHTML = this.steps.map((_, idx) => {
        let cls = "tour-dot";
        if (idx === this.currentStep) cls += " active";
        else if (idx < this.currentStep) cls += " completed";
        return `<div class="${cls}"></div>`;
      }).join("");
    }
  },

  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.renderStep();
    } else {
      this.closeTour();
      if (typeof app !== "undefined") {
        app.showToast("🎉 You're ready to master your finances with SplitSmart AI!");
      }
    }
  },

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.renderStep();
    }
  },

  closeTour() {
    const modal = document.getElementById("guideTourModal");
    if (modal) modal.classList.remove("open");
    localStorage.setItem("splitsmart_tour_completed", "true");
    if (typeof app !== "undefined") {
      app.switchTab("dashboard");
    }
  }
};
