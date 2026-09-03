// Splitwise View Module
const splitView = {
  splitData: null,

  init(splitData) {
    this.splitData = splitData;
    this.renderBalances();
    this.renderFriends();
    this.renderGroups();
    this.renderSimplifiedDebts();
    this.populateModalDropdowns();
  },

  renderBalances() {
    const totalOwed = document.getElementById("splitTotalOwed");
    const totalOwe = document.getElementById("splitTotalOwe");
    const netBal = document.getElementById("splitNetBalance");
    const dashOwed = document.getElementById("dashOwedAmount");
    const dashOwe = document.getElementById("dashOweAmount");

    const d = this.splitData;
    if (!d) return;

    if (totalOwed) totalOwed.textContent = app.formatMoney(d.totalYouAreOwed);
    if (totalOwe) totalOwe.textContent = app.formatMoney(d.totalYouOwe);
    if (dashOwed) dashOwed.textContent = app.formatMoney(d.totalYouAreOwed);
    if (dashOwe) dashOwe.textContent = app.formatMoney(d.totalYouOwe);

    if (netBal) {
      const isPositive = d.netBalance >= 0;
      netBal.textContent = `${isPositive ? "+" : ""}${app.formatMoney(d.netBalance)}`;
      netBal.className = `stat-value ${isPositive ? "text-success" : "text-danger"}`;
    }
  },

  renderFriends() {
    const container = document.getElementById("friendsBalanceList");
    if (!container || !this.splitData?.friends) return;

    container.innerHTML = this.splitData.friends.map(friend => {
      const net = friend.netBalance;
      let statusColor = "#9ca3af";
      let statusText = "Settled up";
      let amountColor = "#9ca3af";

      if (net > 0) {
        statusColor = "#10b981";
        statusText = "Owes you";
        amountColor = "#10b981";
      } else if (net < 0) {
        statusColor = "#ef4444";
        statusText = "You owe";
        amountColor = "#ef4444";
      }

      return `
        <div class="friend-card">
          <div class="friend-info">
            <img class="friend-avatar" src="${friend.avatar}" alt="${friend.name}">
            <div>
              <div style="font-weight: 600; font-size: 0.95rem;">${friend.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${friend.email}</div>
            </div>
          </div>

          <div class="friend-balance-badge">
            <div class="balance-status-text" style="color: ${statusColor};">${statusText}</div>
            <div class="balance-amount" style="color: ${amountColor};">${app.formatMoney(Math.abs(net))}</div>
          </div>
        </div>
      `;
    }).join("");
  },

  renderGroups() {
    const container = document.getElementById("groupsList");
    if (!container || !this.splitData?.groups) return;

    container.innerHTML = this.splitData.groups.map(group => `
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); border-radius: var(--radius-full); padding: 6px 14px; font-size: 0.85rem;">
        <span>${group.icon || "👥"}</span>
        <span style="font-weight: 600;">${group.name}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">(${group.members.length} members)</span>
      </div>
    `).join("");
  },

  renderSimplifiedDebts() {
    const container = document.getElementById("simplifiedDebtsContainer");
    const dashList = document.getElementById("dashSimplifiedDebtList");
    const debts = this.splitData?.simplifiedDebts || [];

    if (debts.length === 0) {
      const emptyHtml = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">🎉 All debts are settled up! No transfers needed.</div>`;
      if (container) container.innerHTML = emptyHtml;
      if (dashList) dashList.innerHTML = emptyHtml;
      return;
    }

    const html = debts.map(d => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); border-left: 3px solid #6366f1;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 600; color: #fff;">${d.from}</span>
          <span style="color: var(--text-muted); font-size: 0.8rem;">pays</span>
          <span style="font-weight: 600; color: #818cf8;">${d.to}</span>
        </div>
        <div style="font-weight: 700; color: #10b981; font-family: 'Outfit'; font-size: 1.05rem;">
          ${app.formatMoney(d.amount)}
        </div>
      </div>
    `).join("");

    if (container) container.innerHTML = html;
    if (dashList) dashList.innerHTML = html;
  },

  populateModalDropdowns() {
    const settleSelect = document.getElementById("settleFriendSelect");
    if (settleSelect && this.splitData?.friends) {
      settleSelect.innerHTML = `
        <option value="">-- Choose Friend --</option>
        ${this.splitData.friends.map(f => {
          const suffix = f.netBalance < 0 ? ` (You owe ${app.formatMoney(Math.abs(f.netBalance))})` : f.netBalance > 0 ? ` (Owes you ${app.formatMoney(f.netBalance)})` : " (Settled)";
          return `<option value="${f.id}" data-amount="${Math.abs(f.netBalance)}">${f.name}${suffix}</option>`;
        }).join("")}
      `;
    }

    const groupSelect = document.getElementById("expGroup");
    if (groupSelect && this.splitData?.groups) {
      groupSelect.innerHTML = `
        <option value="">Direct with Individual Friends</option>
        ${this.splitData.groups.map(g => `<option value="${g.id}">${g.icon} ${g.name}</option>`).join("")}
      `;
    }

    this.renderParticipantCheckboxes();
  },

  renderParticipantCheckboxes(selectedMemberIds = null) {
    const list = document.getElementById("participantsCheckboxList");
    if (!list || !this.splitData?.friends) return;

    list.innerHTML = `
      <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #818cf8; cursor: pointer;">
        <input type="checkbox" checked disabled>
        <span>${app.currentUser ? app.currentUser.name : "You"}</span>
      </label>
      ${this.splitData.friends.map(f => {
        const isChecked = selectedMemberIds ? selectedMemberIds.includes(f.id) : true;
        return `
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
            <input type="checkbox" name="participant" value="${f.id}" ${isChecked ? "checked" : ""}>
            <span>${f.name} (${f.email})</span>
          </label>
        `;
      }).join("")}
    `;
  },

  toggleSplitFields(isSplit) {
    const area = document.getElementById("splitOptionsArea");
    if (area) area.style.display = isSplit ? "block" : "none";
  },

  onGroupSelect(groupId) {
    if (!groupId) {
      this.renderParticipantCheckboxes();
      return;
    }
    const group = this.splitData.groups.find(g => g.id === groupId);
    if (group) {
      this.renderParticipantCheckboxes(group.members);
    }
  },

  onSettleFriendChange(friendId) {
    const select = document.getElementById("settleFriendSelect");
    const amountInput = document.getElementById("settleAmountInput");
    if (!select || !amountInput) return;

    const opt = select.options[select.selectedIndex];
    const defaultAmt = opt ? opt.getAttribute("data-amount") : 0;
    if (defaultAmt && Number(defaultAmt) > 0) {
      amountInput.value = Number(defaultAmt).toFixed(2);
    }
  },

  async submitSettlement(e) {
    e.preventDefault();
    const friendId = document.getElementById("settleFriendSelect").value;
    const amount = Number(document.getElementById("settleAmountInput").value);

    if (!friendId || amount <= 0) {
      app.showToast("❌ Please select a friend and valid amount");
      return;
    }

    try {
      const res = await fetch("/api/splitwise/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, amount })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ Settled ${app.formatMoney(amount)} with friend!`);
        app.closeModals();
        await app.refreshAll();
      }
    } catch (err) {
      app.showToast("❌ Network error settling debt");
    }
  }
};
