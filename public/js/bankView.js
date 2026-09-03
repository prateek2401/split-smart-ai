// Bank View Module - Automated Bank Sync & Roommate Notifications
const bankView = {
  pendingTransactions: [],
  notifications: [],

  async init() {
    await this.fetchPendingAndNotifications();
    this.renderBankAlerts();
    this.renderNotificationsFeed();
  },

  async fetchPendingAndNotifications() {
    try {
      const [pendingRes, notifsRes] = await Promise.all([
        fetch('/api/bank/pending').then(r => r.json()),
        fetch('/api/notifications').then(r => r.json())
      ]);

      if (pendingRes.success) this.pendingTransactions = pendingRes.data;
      if (notifsRes.success) this.notifications = notifsRes.data;
    } catch (err) {
      console.error('Error fetching bank transactions:', err);
    }
  },

  renderBankAlerts() {
    const container = document.getElementById('bankAlertsContainer');
    if (!container) return;

    if (this.pendingTransactions.length === 0) {
      container.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 18px 22px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 24px; background: rgba(99, 102, 241, 0.1); padding: 8px; border-radius: var(--radius-sm);">🏦</div>
            <div>
              <div style="font-weight: 600; font-size: 0.95rem;">Bank Feed Connected (Pluck / Open Banking Active)</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Listening for debit webhooks (Rent, EMI, Utilities, Groceries). No unreviewed debits right now.</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="bankView.simulateTransaction('rent')">
              ⚡ Test Rent ($1,500)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="bankView.simulateTransaction('wifi')">
              ⚡ Test WiFi ($85)
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.pendingTransactions.map(tx => `
      <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: var(--radius-md); padding: 20px 24px; box-shadow: 0 8px 30px rgba(99, 102, 241, 0.15); animation: fadeIn 0.3s ease;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px;">
          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <div style="font-size: 28px; background: rgba(99, 102, 241, 0.2); width: 50px; height: 50px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
              🏦
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="ai-pill" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #6ee7b7; font-size: 0.75rem;">
                  ● LIVE BANK PAYMENT DETECTED
                </span>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${tx.bankName}</span>
              </div>
              <h3 style="font-size: 1.25rem; font-weight: 700; margin-top: 4px;">${tx.merchant}</h3>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                Raw Statement Memo: <em>${tx.rawDescription}</em>
              </p>
            </div>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 1.6rem; font-weight: 800; font-family: 'Outfit'; color: #fff;">
              $${tx.amount.toFixed(2)}
            </div>
            <div style="font-size: 0.8rem; color: #a5b4fc; font-weight: 600;">
              AI Match: 🏠 Rent
            </div>
          </div>
        </div>

        <div style="background: rgba(0, 0, 0, 0.25); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="font-size: 0.88rem; color: #e0e7ff;">
            💡 <strong>AI Suggestion:</strong> This matches your recurring commitment for <strong>${tx.suggestedGroupName || 'Flat #402 Roommates'}</strong>. 
            Split across ${tx.splitCount} members ($${tx.perPersonShare.toFixed(2)} / person).
          </div>
          <span style="font-size: 0.8rem; color: #10b981; font-weight: 600;">Your share: $${tx.perPersonShare.toFixed(2)}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
          <button class="btn btn-secondary btn-sm" onclick="bankView.processTransaction('${tx.id}', 'DISMISS')">
            ✕ Dismiss
          </button>
          <button class="btn btn-secondary btn-sm" onclick="bankView.processTransaction('${tx.id}', 'PERSONAL')">
            👤 Log as Personal Only ($${tx.amount.toFixed(2)})
          </button>
          <button class="btn btn-success" onclick="bankView.processTransaction('${tx.id}', 'SPLIT')">
            👥 1-Click Split & Notify Roommates ($${tx.perPersonShare.toFixed(2)} each)
          </button>
        </div>
      </div>
    `).join('');
  },

  renderNotificationsFeed() {
    const feed = document.getElementById('roommateNotificationFeed');
    if (!feed) return;

    if (this.notifications.length === 0) {
      feed.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">No recent broadcast alerts.</div>`;
      return;
    }

    feed.innerHTML = this.notifications.map(n => {
      const timeStr = new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid #10b981;">
          <span style="font-size: 16px;">📢</span>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: 600; font-size: 0.88rem; color: #fff;">${n.title}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);">${timeStr}</span>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">${n.message}</p>
            <span class="category-badge badge-fixed" style="font-size: 0.68rem; margin-top: 4px; display: inline-block;">
              To: ${n.targetGroup}
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  async processTransaction(transactionId, action) {
    try {
      const res = await fetch('/api/bank/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, action })
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'SPLIT') {
          app.showToast('✅ Bank payment split! Roommates notified & balances updated.');
        } else if (action === 'PERSONAL') {
          app.showToast('✅ Logged as personal expense.');
        } else {
          app.showToast('Dismissed bank transaction.');
        }
        await app.refreshAll();
        await this.init();
      }
    } catch (err) {
      app.showToast('❌ Error processing bank transaction');
    }
  },

  async simulateTransaction(type) {
    try {
      const res = await fetch('/api/bank/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`🔔 Bank webhook received: $${data.data.amount} for ${data.data.merchant}`);
        await this.init();
      }
    } catch (err) {
      app.showToast('❌ Simulation error');
    }
  }
};
