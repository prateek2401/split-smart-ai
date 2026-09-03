// Bank View Module - PhonePe, Paytm & HDFC Auto-Sync & Roommate Notifications
const bankView = {
  tempBank: null,

  currentMobileLinkData: null,

  firebaseConfirmationResult: null,

  initFirebase() {
    if (typeof firebase !== "undefined" && typeof FIREBASE_CONFIG !== "undefined") {
      try {
        if (!firebase.apps.length && isFirebaseConfigured()) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
      } catch (err) {
        console.warn("Firebase initialization skipped:", err);
      }
    }
  },

  toggleFirebaseHelp() {
    const box = document.getElementById("firebaseHelpBox");
    if (box) {
      box.style.display = box.style.display === "none" ? "block" : "none";
    }
  },


  updateVpaPreview() {
    const phoneInput = document.getElementById("linkMobileNumber");
    const vpaInput = document.getElementById("linkUpiVpa");
    if (phoneInput && vpaInput) {
      const clean = phoneInput.value.replace(/[^0-9]/g, "").slice(-10);
      if (clean) vpaInput.value = `${clean}@ybl`;
    }
  },

  async sendMobileOtp() {
    const phoneInput = document.getElementById("linkMobileNumber");
    const bankSelect = document.getElementById("linkPrimaryBank");
    const vpaInput = document.getElementById("linkUpiVpa");

    const phone = phoneInput ? phoneInput.value.trim() : "";
    const bankName = bankSelect ? bankSelect.value : "HDFC Bank";
    const upiId = vpaInput ? vpaInput.value.trim() : "";
    const cleanPhone = phone.replace(/[^0-9]/g, "").slice(-10);

    if (!cleanPhone || cleanPhone.length < 10) {
      app.showToast("❌ Please enter a valid 10-digit mobile number");
      return;
    }

    // CHECK IF REAL FIREBASE KEYS ARE CONFIGURED
    if (typeof isFirebaseConfigured === "function" && isFirebaseConfigured()) {
      try {
        this.initFirebase();
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
            size: "invisible"
          });
        }
        app.showToast("⏳ Contacting Google Firebase SMS Gateway...");
        const confirmationResult = await firebase.auth().signInWithPhoneNumber("+91" + cleanPhone, window.recaptchaVerifier);
        this.firebaseConfirmationResult = confirmationResult;
        this.currentMobileLinkData = { phone: cleanPhone, bankName, upiId };

        const stepInput = document.getElementById("otpStepInput");
        const stepVerify = document.getElementById("otpStepVerify");
        const targetPhone = document.getElementById("otpTargetPhone");
        const demoBadge = document.getElementById("demoOtpBadge");

        if (targetPhone) targetPhone.textContent = `+91 ${cleanPhone}`;
        if (demoBadge) demoBadge.textContent = "REAL SMS SENT TO PHONE";
        if (stepInput) stepInput.style.display = "none";
        if (stepVerify) stepVerify.style.display = "block";

        app.showToast(`🔥 Real SMS OTP sent to +91 ${cleanPhone} via Google Firebase!`);
        return;
      } catch (fbErr) {
        console.warn("Firebase Phone Auth error, falling back to instant test OTP:", fbErr);
        app.showToast("⚠️ Firebase note: Falling back to Instant Test OTP (Check API key)");
      }
    }

    // FALLBACK / PROTOTYPE TEST MODE
    try {
      const res = await fetch("/api/bank/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, bankName, upiId })
      });
      const data = await res.json();
      if (data.success) {
        this.currentMobileLinkData = data;
        const stepInput = document.getElementById("otpStepInput");
        const stepVerify = document.getElementById("otpStepVerify");
        const targetPhone = document.getElementById("otpTargetPhone");
        const demoBadge = document.getElementById("demoOtpBadge");

        if (targetPhone) targetPhone.textContent = `+91 ${data.phone}`;
        if (demoBadge) demoBadge.textContent = data.demoOtp;
        if (stepInput) stepInput.style.display = "none";
        if (stepVerify) stepVerify.style.display = "block";

        app.showToast(`📩 Test OTP generated: Use ${data.demoOtp} (or add Firebase key for real SMS)`);
      } else {
        app.showToast("❌ " + data.error);
      }
    } catch (err) {
      app.showToast("❌ Error generating verification OTP");
    }
  },

  autoFillDemoOtp() {
    const input = document.getElementById("otpInputField");
    if (input) input.value = "482910";
  },

  backToOtpInput() {
    const stepInput = document.getElementById("otpStepInput");
    const stepVerify = document.getElementById("otpStepVerify");
    const stepDiscovered = document.getElementById("otpStepDiscovered");

    if (stepInput) stepInput.style.display = "block";
    if (stepVerify) stepVerify.style.display = "none";
    if (stepDiscovered) stepDiscovered.style.display = "none";
  },

  async verifyMobileOtp() {
    const otpInput = document.getElementById("otpInputField");
    const otp = otpInput ? otpInput.value.trim() : "";

    if (!otp || otp.length < 6) {
      app.showToast("❌ Please enter the 6-digit verification code");
      return;
    }

    if (!this.currentMobileLinkData) return;

    // IF USING REAL FIREBASE CONFIRMATION
    if (this.firebaseConfirmationResult) {
      try {
        app.showToast("⏳ Verifying OTP with Google Firebase...");
        await this.firebaseConfirmationResult.confirm(otp);
        app.showToast("✓ Firebase confirmed code!");
      } catch (fbErr) {
        app.showToast("❌ Invalid Firebase SMS code. Please try again.");
        return;
      }
    }

    try {
      const res = await fetch("/api/bank/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: this.currentMobileLinkData.phone,
          otp,
          bankName: this.currentMobileLinkData.bankName || "HDFC Bank"
        })
      });
      const data = await res.json();
      if (data.success) {
        const stepVerify = document.getElementById("otpStepVerify");
        const stepDiscovered = document.getElementById("otpStepDiscovered");
        const phoneDisplay = document.getElementById("discoveredPhoneDisplay");
        const list = document.getElementById("discoveredAccountsList");

        if (phoneDisplay) phoneDisplay.textContent = data.phone;

        if (list && data.discoveredAccounts) {
          list.innerHTML = data.discoveredAccounts.map(acc => `
            <div class="discovered-account-card">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">${acc.logo}</span>
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: #fff;">${acc.title}</div>
                  <div style="font-size: 0.76rem; color: #94a3b8;">${acc.vpa || (acc.accountType + " " + acc.accountNumber)}</div>
                </div>
              </div>
              <span class="category-badge badge-variable" style="background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); color: #6ee7b7; font-size: 0.72rem;">
                ✓ ${acc.status}
              </span>
            </div>
          `).join("");
        }

        if (stepVerify) stepVerify.style.display = "none";
        if (stepDiscovered) stepDiscovered.style.display = "block";

        app.showToast("🎉 Verified! Discovered 3 linked accounts.");
      } else {
        app.showToast("❌ " + data.error);
      }
    } catch (err) {
      app.showToast("❌ Error verifying OTP");
    }
  },

  async completeMobileLinking() {
    app.closeModals();
    app.showToast("🚀 PhonePe & Bank linked successfully! Auto-sync is active.");
    await app.refreshAll();
    await this.init();
  },


  activeSources: [],

  async fetchActiveSources() {
    try {
      const res = await fetch("/api/bank/sources").then(r => r.json());
      if (res.success) this.activeSources = res.data;
    } catch (err) {
      console.error("Error fetching payment sources:", err);
    }
  },

  switchModalTab(tab) {
    const tabMobileOtp = document.getElementById("modalTabMobileOtp");
    const tabCheckboxes = document.getElementById("modalTabCheckboxes");
    const tabApp2App = document.getElementById("modalTabApp2App");
    const btnMobileOtp = document.getElementById("tabBtnMobileOtp");
    const btnCheckboxes = document.getElementById("tabBtnCheckboxes");
    const btnApp2App = document.getElementById("tabBtnApp2App");

    const tabs = [tabMobileOtp, tabCheckboxes, tabApp2App];
    const btns = [btnMobileOtp, btnCheckboxes, btnApp2App];

    tabs.forEach(t => { if (t) t.style.display = "none"; });
    btns.forEach(b => { if (b) { b.style.background = ""; b.style.borderColor = ""; b.style.color = ""; } });

    if (tab === "mobileotp") {
      if (tabMobileOtp) tabMobileOtp.style.display = "block";
      if (btnMobileOtp) {
        btnMobileOtp.style.background = "rgba(99, 102, 241, 0.2)";
        btnMobileOtp.style.borderColor = "#6366f1";
        btnMobileOtp.style.color = "#a5b4fc";
      }
      this.backToOtpInput();
    } else if (tab === "checkboxes") {
      if (tabCheckboxes) tabCheckboxes.style.display = "block";
      if (btnCheckboxes) {
        btnCheckboxes.style.background = "rgba(99, 102, 241, 0.2)";
        btnCheckboxes.style.borderColor = "#6366f1";
        btnCheckboxes.style.color = "#a5b4fc";
      }
    } else {
      if (tabApp2App) tabApp2App.style.display = "block";
      if (btnApp2App) {
        btnApp2App.style.background = "rgba(99, 102, 241, 0.2)";
        btnApp2App.style.borderColor = "#6366f1";
        btnApp2App.style.color = "#a5b4fc";
      }
      this.backToBankSelection();
    }
  },
  _unused_switch(tab) {

    if (tab === "checkboxes") {
      if (tabCheckboxes) tabCheckboxes.style.display = "block";
      if (tabApp2App) tabApp2App.style.display = "none";
      if (btnCheckboxes) {
        btnCheckboxes.style.background = "rgba(99, 102, 241, 0.2)";
        btnCheckboxes.style.borderColor = "#6366f1";
        btnCheckboxes.style.color = "#a5b4fc";
      }
      if (btnApp2App) {
        btnApp2App.style.background = "";
        btnApp2App.style.borderColor = "";
        btnApp2App.style.color = "";
      }
    } else {
      if (tabCheckboxes) tabCheckboxes.style.display = "none";
      if (tabApp2App) tabApp2App.style.display = "block";
      if (btnApp2App) {
        btnApp2App.style.background = "rgba(99, 102, 241, 0.2)";
        btnApp2App.style.borderColor = "#6366f1";
        btnApp2App.style.color = "#a5b4fc";
      }
      if (btnCheckboxes) {
        btnCheckboxes.style.background = "";
        btnCheckboxes.style.borderColor = "";
        btnCheckboxes.style.color = "";
      }
      this.backToBankSelection();
    }
  },

  toggleSourceCard(input) {
    if (!input) return;
    const card = input.closest(".source-checkbox-card");
    if (card) {
      if (input.checked) card.classList.add("selected");
      else card.classList.remove("selected");
    }
  },

  selectAllSources(shouldSelect) {
    const inputs = document.querySelectorAll(".source-checkbox-input");
    inputs.forEach(inp => {
      inp.checked = shouldSelect;
      this.toggleSourceCard(inp);
    });
  },

  async saveSelectedSources() {
    const inputs = Array.from(document.querySelectorAll(".source-checkbox-input:checked"));
    const activeIds = inputs.map(i => i.value);

    try {
      const res = await fetch("/api/bank/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeIds })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ Saved ${activeIds.length} active payment sources!`);
        app.closeModals();
        await this.init();
      } else {
        app.showToast("❌ " + data.error);
      }
    } catch (err) {
      app.showToast("❌ Failed to save payment sources");
    }
  },

  connectedBanks: [],

  openLinkBankModal() {
    this.backToBankSelection();
    const modal = document.getElementById("linkBankModal");
    if (modal) modal.classList.add("open");
  },

  startAppToAppHandshake(bankName, accountNumber, accountType) {
    this.tempBank = { bankName, accountNumber, accountType };
    const step1 = document.getElementById("bankSelectionScreen");
    const step2 = document.getElementById("app2AppHandshakeScreen");
    const title = document.getElementById("handshakeBankTitle");
    const uri = document.getElementById("handshakeUri");
    const accType = document.getElementById("handshakeAccountType");
    const accNum = document.getElementById("handshakeAccountNum");

    const schemes = {
      "HDFC Bank": "hdfcbank://consent?scope=read.transactions",
      "ICICI Bank": "imobile://consent?scope=read.transactions",
      "State Bank of India (SBI)": "sbiyono://consent?scope=read.transactions",
      "Axis Bank": "axisbank://consent?scope=read.transactions"
    };

    if (title) title.textContent = `${bankName} Mobile App`;
    if (uri) uri.textContent = schemes[bankName] || "intent://consent#bank";
    if (accType) accType.textContent = accountType;
    if (accNum) accNum.textContent = accountNumber;

    if (step1) step1.style.display = "none";
    if (step2) step2.style.display = "block";
  },

  backToBankSelection() {
    const step1 = document.getElementById("bankSelectionScreen");
    const step2 = document.getElementById("app2AppHandshakeScreen");
    if (step1) step1.style.display = "block";
    if (step2) step2.style.display = "none";
  },

  async confirmBankConnection() {
    if (!this.tempBank) return;
    try {
      const res = await fetch("/api/bank/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.tempBank)
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`🎉 ${this.tempBank.bankName} connected via App2App Handshake!`);
        app.closeModals();
        await app.refreshAll();
        await this.init();
      }
    } catch (err) {
      app.showToast("❌ Bank connection failed");
    }
  },
  pendingTransactions: [],
  notifications: [],

  async init() {
    await this.fetchPendingAndNotifications();
    await this.fetchActiveSources();
    this.renderBankAlerts();
    this.renderNotificationsFeed();
  },

  async fetchPendingAndNotifications() {
    try {
      const [pendingRes, notifsRes] = await Promise.all([
        fetch("/api/bank/pending").then(r => r.json()),
        fetch("/api/notifications").then(r => r.json())
      ]);

      if (pendingRes.success) this.pendingTransactions = pendingRes.data;
      if (notifsRes.success) this.notifications = notifsRes.data;
    } catch (err) {
      console.error("Error fetching bank transactions:", err);
    }
  },

  renderBankAlerts() {
    const container = document.getElementById("bankAlertsContainer");
    if (!container) return;

    // Always render the PhonePe, Paytm & HDFC Bank Auto-Sync Panel
    let pendingHtml = "";
    if (this.pendingTransactions && this.pendingTransactions.length > 0) {
      pendingHtml = this.pendingTransactions.map(tx => `
        <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: var(--radius-md); padding: 18px 22px; margin-bottom: 16px; box-shadow: 0 8px 30px rgba(99, 102, 241, 0.15);">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <div style="font-size: 26px; background: rgba(99, 102, 241, 0.2); width: 46px; height: 46px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
                🏦
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="ai-pill" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #6ee7b7; font-size: 0.72rem;">
                    ● LIVE BANK DEBIT DETECTED
                  </span>
                  <span style="font-size: 0.78rem; color: var(--text-muted);">${tx.bankName}</span>
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 3px;">${tx.merchant}</h3>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                  Statement: <em>${tx.rawDescription}</em>
                </p>
              </div>
            </div>

            <div style="text-align: right;">
              <div style="font-size: 1.45rem; font-weight: 800; font-family: 'Outfit'; color: #fff;">
                ${app.formatMoney(tx.amount)}
              </div>
              <div style="font-size: 0.75rem; color: #a5b4fc; font-weight: 600;">
                AI Match: 🏠 Rent
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="bankView.processTransaction('${tx.id}', 'DISMISS')">
              ✕ Dismiss
            </button>
            <button class="btn btn-secondary btn-sm" onclick="bankView.processTransaction('${tx.id}', 'PERSONAL')">
              👤 Personal Only (${app.formatMoney(tx.amount)})
            </button>
            <button class="btn btn-success btn-sm" onclick="bankView.processTransaction('${tx.id}', 'SPLIT')">
              👥 1-Click Split & Notify Roommates (${app.formatMoney(tx.perPersonShare)} each)
            </button>
          </div>
        </div>
      `).join("");
    }

    // PhonePe, Paytm & HDFC Auto-Capture Control Center
    container.innerHTML = `
      ${pendingHtml}
      <div class="card" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 27, 75, 0.4) 100%); border: 1px solid rgba(99, 102, 241, 0.25);">
        <div class="card-header" style="margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">📱</span>
            <div>
              <h3 class="card-title" style="font-size: 1.15rem;">PhonePe, Paytm & HDFC Bank Auto-Sync</h3>
              <p class="card-subtitle">Real-time payment capture: debits from your bank or UPI are auto-categorized and added to your expense list.</p>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="bankView.openLinkBankModal()" style="border-color: #818cf8; color: #a5b4fc; font-size: 0.78rem;">
              ☑ Manage Payment Modes
            </button>
            <span class="category-badge badge-variable" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.3);">
              🟢 Auto-Sync Active
            </span>
          </div>
        </div>

        <!-- Active Monitored Sources Pills -->
        <div style="margin-bottom: 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span style="font-size: 0.76rem; color: #94a3b8; font-weight: 600;">Monitored Modes:</span>
          ${(this.activeSources || []).filter(s => s.isActive).map(s => `
            <span class="source-pill-active">
              <span>${s.icon}</span> ${s.name.split(" ")[0]}
            </span>
          `).join("")}
        </div>

        <!-- 1-Click Simulators for PhonePe / Paytm / HDFC -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 0.82rem; font-weight: 600; color: #a5b4fc; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            ⚡ Quick Test Payment Events:
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="bankView.triggerAutoCapture('phonepe-rent')" style="border-color: #6366f1;">
              📱 PhonePe: Paid ${app.formatMoney(1500)} Rent (Split)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="bankView.triggerAutoCapture('paytm-grocery')" style="border-color: #06b6d4;">
              📱 Paytm: Paid ${app.formatMoney(650)} Groceries (Split)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="bankView.triggerAutoCapture('hdfc-bills')" style="border-color: #ec4899;">
              🏦 HDFC Bank: Paid ${app.formatMoney(2200)} Electricity
            </button>
            <button class="btn btn-secondary btn-sm" onclick="bankView.triggerAutoCapture('phonepe-aarav-dinner')" style="border-color: #f59e0b;">
              📱 Aarav (PhonePe): Paid ${app.formatMoney(1200)} Dinner
            </button>
          </div>
        </div>

        <!-- Interactive Bank SMS / Notification Parser -->
        <div style="background: rgba(0, 0, 0, 0.25); border-radius: var(--radius-sm); padding: 14px; border: 1px dashed rgba(255, 255, 255, 0.12);">
          <label style="font-size: 0.82rem; font-weight: 600; color: #e2e8f0; display: block; margin-bottom: 6px;">
            💬 Or Paste Real Bank / UPI Debit SMS to Auto-Add:
          </label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="bankSmsInput" class="form-input" placeholder="e.g. Paid Rs 850 at Swiggy via PhonePe UPI on HDFC Bank A/C XX4829" style="flex: 1;">
            <button class="btn btn-primary btn-sm" onclick="bankView.parseSmsInput()">
              ⚡ Parse & Auto-Add
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderNotificationsFeed() {
    const feed = document.getElementById("roommateNotificationFeed");
    if (!feed) return;

    if (this.notifications.length === 0) {
      feed.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">No recent broadcast alerts.</div>`;
      return;
    }

    feed.innerHTML = this.notifications.map(n => {
      const timeStr = new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    }).join("");
  },

  async triggerAutoCapture(type) {
    try {
      const res = await fetch("/api/bank/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ ${data.message}`);
        await app.refreshAll();
        await this.init();
      }
    } catch (err) {
      app.showToast("❌ Auto-capture error");
    }
  },

  async parseSmsInput() {
    const input = document.getElementById("bankSmsInput");
    const text = input ? input.value.trim() : "";
    if (!text) {
      app.showToast("❌ Please paste or type a bank debit SMS");
      return;
    }

    try {
      const res = await fetch("/api/bank/parse-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, autoAdd: true })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`✅ ${data.message}`);
        if (input) input.value = "";
        await app.refreshAll();
        await this.init();
      } else {
        app.showToast("❌ " + data.error);
      }
    } catch (err) {
      app.showToast("❌ Error parsing SMS");
    }
  },

  async processTransaction(transactionId, action) {
    try {
      const res = await fetch("/api/bank/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, action })
      });
      const data = await res.json();
      if (data.success) {
        if (action === "SPLIT") {
          app.showToast("✅ Bank payment split! Roommates notified & balances updated.");
        } else if (action === "PERSONAL") {
          app.showToast("✅ Logged as personal expense.");
        } else {
          app.showToast("Dismissed bank transaction.");
        }
        await app.refreshAll();
        await this.init();
      }
    } catch (err) {
      app.showToast("❌ Error processing bank transaction");
    }
  }
};
