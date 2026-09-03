// AI View Module
const aiView = {
  aiData: null,

  init(aiData) {
    this.aiData = aiData;
    this.renderForecastHero();
    this.renderRecommendations();
    this.updateSimulator(10);
  },

  renderForecastHero() {
    const d = this.aiData;
    if (!d) return;

    // Dashboard widgets
    const dashPred = document.getElementById("dashPredictedSavings");
    const dashVariance = document.getElementById("dashSavingsVariance");
    const dashAiStatus = document.getElementById("dashAiStatusBadge");
    const dashAiSummary = document.getElementById("dashAiSummaryText");

    // AI Tab widgets
    const aiPred = document.getElementById("aiPredictedSavings");
    const aiVariance = document.getElementById("aiSavingsVarianceText");
    const aiVelocity = document.getElementById("aiDailyVelocity");
    const aiVelocitySub = document.getElementById("aiVelocityComparison");
    const aiAnnual = document.getElementById("aiAnnualSavings");
    const aiCompound = document.getElementById("aiCompoundText");
    const aiStatusPill = document.getElementById("aiStatusPill");

    const predSavings = d.predictions.predictedSavings;
    const variance = d.predictions.savingsVariance;
    const isAhead = variance >= 0;

    if (dashPred) dashPred.textContent = app.formatMoney(predSavings);
    if (dashVariance) dashVariance.textContent = `${d.predictions.savingsGoalProgress}% of ${app.formatMoney(d.monthlyOverview.targetSavings)} target`;

    if (aiPred) {
      aiPred.textContent = app.formatMoney(predSavings);
      aiPred.className = `stat-value ${predSavings >= 0 ? "text-success" : "text-danger"}`;
    }

    if (aiVariance) {
      aiVariance.textContent = `${isAhead ? "+" : "-"}${app.formatMoney(Math.abs(variance))} vs target`;
      aiVariance.style.color = isAhead ? "#10b981" : "#ef4444";
    }

    if (aiVelocity) {
      aiVelocity.textContent = `${app.formatMoney(d.monthlyOverview.dailyVariableVelocity)}/day`;
    }

    if (aiVelocitySub) {
      aiVelocitySub.textContent = `Day ${d.timeline.currentDay} of ${d.timeline.totalDaysInMonth} (${d.timeline.remainingDays} days remaining)`;
    }

    if (aiAnnual) {
      aiAnnual.textContent = app.formatMoney(d.annualForecast.projectedAnnualSavings);
    }

    if (aiCompound) {
      aiCompound.textContent = `~${app.formatMoney(d.annualForecast.compoundInterest7Pct)} with 7% growth`;
    }

    // Status pill
    let statusLabel = "● ON TRACK";
    let statusClass = "badge-variable";

    if (d.predictions.status === "AT_RISK") {
      statusLabel = "▲ SAVINGS AT RISK";
      statusClass = "badge-fixed";
    } else if (d.predictions.status === "DEFICIT") {
      statusLabel = "✕ BUDGET DEFICIT";
      statusClass = "category-badge";
    }

    if (aiStatusPill) {
      aiStatusPill.textContent = statusLabel;
      aiStatusPill.className = `category-badge ${statusClass}`;
    }
    if (dashAiStatus) {
      dashAiStatus.textContent = statusLabel;
      dashAiStatus.className = `category-badge ${statusClass}`;
    }

    if (dashAiSummary) {
      dashAiSummary.innerHTML = `
        At your current variable velocity of <strong>${app.formatMoney(d.monthlyOverview.dailyVariableVelocity)}/day</strong>, 
        you are forecasted to finish the month with <strong>${app.formatMoney(predSavings)}</strong> in net savings 
        (${d.predictions.savingsGoalProgress}% of your ${app.formatMoney(d.monthlyOverview.targetSavings)} goal).
      `;
    }
  },

  renderRecommendations() {
    const list = document.getElementById("aiRecommendationsList");
    if (!list || !this.aiData?.recommendations) return;

    const typeIcons = {
      WARNING: "⚠️",
      CRITICAL: "🚨",
      SUCCESS: "🎯",
      INFO: "💡",
      SMART_OPTIMIZATION: "⚡"
    };

    const typeClasses = {
      WARNING: "rec-warning",
      CRITICAL: "rec-critical",
      SUCCESS: "rec-success",
      INFO: "rec-info",
      SMART_OPTIMIZATION: "rec-optimization"
    };

    list.innerHTML = this.aiData.recommendations.map(r => `
      <div class="ai-recommendation-card ${typeClasses[r.type] || "rec-info"}">
        <div class="rec-icon">${typeIcons[r.type] || "💡"}</div>
        <div class="rec-content">
          <h4>${r.title}</h4>
          <p>${r.message}</p>
          <div class="rec-action">👉 AI Recommendation: ${r.action}</div>
        </div>
      </div>
    `).join("");
  },

  updateSimulator(percentValue) {
    const pct = Number(percentValue);
    const label = document.getElementById("simulatorPercentLabel");
    const extraMonthly = document.getElementById("simExtraMonthly");
    const extraAnnual = document.getElementById("simExtraAnnual");
    const analysisText = document.getElementById("simAnalysisText");

    if (label) label.textContent = `${pct}% Cut`;

    if (!this.aiData) return;

    const variableTotal = this.aiData.monthlyOverview.variableSpentTotal + (this.aiData.monthlyOverview.dailyVariableVelocity * this.aiData.timeline.remainingDays);
    const monthlyExtra = Math.round(variableTotal * (pct / 100));
    const annualExtra = monthlyExtra * 12;

    if (extraMonthly) extraMonthly.textContent = `+${app.formatMoney(monthlyExtra)}`;
    if (extraAnnual) extraAnnual.textContent = `+${app.formatMoney(annualExtra)}`;

    if (analysisText) {
      analysisText.innerHTML = `
        By trimming variable daily spending (dining, impulse, personal) by <strong>${pct}%</strong>, 
        you retain an additional <strong>${app.formatMoney(monthlyExtra)}</strong> every month, 
        yielding <strong>+${app.formatMoney(annualExtra)}</strong> in compounded annual wealth accumulation!
      `;
    }
  }
};
