// Main App Controller
// Orchestrates views routing, roles login validation, settings panels, databases operations, and Steve visual logging panels.

document.addEventListener("DOMContentLoaded", () => {
  // Global DOM selectors
  const sidebar = document.getElementById("app-sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const currentViewTitle = document.getElementById("current-view-title");
  const themeToggle = document.getElementById("theme-toggle");
  const settingsDarkToggle = document.getElementById("settings-dark-theme-toggle");
  const roleSelectTrigger = document.getElementById("role-select-trigger");
  const headerRoleLabel = document.getElementById("header-role-label");
  const modalRoleSelect = document.getElementById("modal-role-select");
  const roleOptionsList = document.getElementById("role-options-list");

  // Auth screen selectors
  const authScreen = document.getElementById("auth-screen");
  const authLoginForm = document.getElementById("auth-login-form");
  const authOtpForm = document.getElementById("auth-otp-form");
  const authForgotForm = document.getElementById("auth-forgot-form");
  const authResetForm = document.getElementById("auth-reset-form");
  const authRegisterForm = document.getElementById("auth-register-form");
  const authLoginError = document.getElementById("auth-login-error");
  const authOtpError = document.getElementById("auth-otp-error");
  const authForgotError = document.getElementById("auth-forgot-error");
  const authForgotSuccess = document.getElementById("auth-forgot-success");
  const authResetError = document.getElementById("auth-reset-error");
  const authRegisterError = document.getElementById("auth-register-error");
  const authRegisterSuccess = document.getElementById("auth-register-success");
  const authRateLimitMsg = document.getElementById("auth-rate-limit-msg");
  const authOtpEmailDisplay = document.getElementById("auth-otp-email-display");

  let activeView = "dashboard";
  let activeOrderFilter = "all";
  let pendingForgotEmail = null;

  // Initialize Lucide Icons
  try { lucide.createIcons(); } catch (e) { console.warn("Lucide icons failed:", e); }

  // ==================== AUTH SYSTEM ====================
  const showAuthForm = (formId) => {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(formId).classList.add('active');
    // Clear errors
    document.querySelectorAll('.auth-error, .auth-success').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
  };

  const hideAuthScreen = () => {
    authScreen.classList.add('hidden');
    document.body.style.overflow = '';
  };

  // Login button - direct login, no OTP
  document.getElementById("auth-login-btn").addEventListener("click", async () => {
    const username = document.getElementById("auth-username").value;
    const password = document.getElementById("auth-password").value;

    authLoginError.style.display = 'none';
    authRateLimitMsg.style.display = 'none';

    const result = await window.authSystem.login(username, password);

    if (!result.success) {
      if (result.rateLimited) {
        authRateLimitMsg.textContent = result.error;
        authRateLimitMsg.style.display = 'block';
      } else {
        authLoginError.textContent = result.error;
        authLoginError.style.display = 'block';
      }
      return;
    }

    // Login successful directly - no OTP needed
    hideAuthScreen();
    initApp();
  });

  // Enter key on password field
  document.getElementById("auth-password").addEventListener("keydown", (e) => {
    if (e.key === 'Enter') document.getElementById("auth-login-btn").click();
  });

  // Verify Registration OTP button
  document.getElementById("auth-verify-otp-btn").addEventListener("click", async () => {
    const otp = document.getElementById("auth-otp-input").value;
    authOtpError.style.display = 'none';

    if (otp.length !== 6) {
      authOtpError.textContent = 'Please enter a valid 6-digit OTP.';
      authOtpError.style.display = 'block';
      return;
    }

    const result = await window.authSystem.verifyRegistrationOtp(otp);

    if (!result.success) {
      authOtpError.textContent = result.error;
      authOtpError.style.display = 'block';
      return;
    }

    // Registration complete + auto-logged in
    hideAuthScreen();
    initApp();
  });

  // Enter key on OTP field
  document.getElementById("auth-otp-input").addEventListener("keydown", (e) => {
    if (e.key === 'Enter') document.getElementById("auth-verify-otp-btn").click();
  });

  // Forgot password link
  document.getElementById("auth-forgot-link").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("auth-forgot-email").value = '';
    authForgotError.style.display = 'none';
    authForgotSuccess.style.display = 'none';
    showAuthForm('auth-forgot-form');
  });

  // Send OTP for password reset
  document.getElementById("auth-send-otp-btn").addEventListener("click", async () => {
    const email = document.getElementById("auth-forgot-email").value;
    authForgotError.style.display = 'none';
    authForgotSuccess.style.display = 'none';

    const result = await window.authSystem.forgotPassword(email);

    if (!result.success) {
      authForgotError.textContent = result.error;
      authForgotError.style.display = 'block';
      return;
    }

    pendingForgotEmail = result.email;
    document.getElementById("auth-reset-otp").value = '';
    document.getElementById("auth-reset-new-password").value = '';
    document.getElementById("auth-reset-confirm-password").value = '';
    showAuthForm('auth-reset-form');
  });

  // Reset password button
  document.getElementById("auth-reset-btn").addEventListener("click", async () => {
    const otp = document.getElementById("auth-reset-otp").value;
    const newPass = document.getElementById("auth-reset-new-password").value;
    const confirmPass = document.getElementById("auth-reset-confirm-password").value;
    authResetError.style.display = 'none';

    if (newPass !== confirmPass) {
      authResetError.textContent = 'Passwords do not match.';
      authResetError.style.display = 'block';
      return;
    }

    const result = await window.authSystem.resetPassword(pendingForgotEmail, otp, newPass);

    if (!result.success) {
      authResetError.textContent = result.error;
      authResetError.style.display = 'block';
      return;
    }

    alert('Password reset successful! You can now login with your new password.');
    showAuthForm('auth-login-form');
  });

  // Register link
  document.getElementById("auth-register-link").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("auth-reg-username").value = '';
    document.getElementById("auth-reg-email").value = '';
    document.getElementById("auth-reg-password").value = '';
    authRegisterError.style.display = 'none';
    authRegisterSuccess.style.display = 'none';
    showAuthForm('auth-register-form');
  });

  // Register button
  document.getElementById("auth-register-btn").addEventListener("click", async () => {
    const username = document.getElementById("auth-reg-username").value;
    const email = document.getElementById("auth-reg-email").value;
    const password = document.getElementById("auth-reg-password").value;
    authRegisterError.style.display = 'none';
    authRegisterSuccess.style.display = 'none';

    const result = await window.authSystem.register(username, email, password);

    if (!result.success) {
      authRegisterError.textContent = result.error;
      authRegisterError.style.display = 'block';
      return;
    }

    if (result.requiresOtp) {
      authOtpEmailDisplay.textContent = result.maskedEmail || 'your email';
      document.getElementById("auth-otp-input").value = '';
      authOtpError.style.display = 'none';
      showAuthForm('auth-otp-form');
    }
  });

  // Back to login links
  document.getElementById("auth-back-login-link").addEventListener("click", (e) => { e.preventDefault(); showAuthForm('auth-login-form'); });
  document.getElementById("auth-back-login-from-forgot").addEventListener("click", (e) => { e.preventDefault(); showAuthForm('auth-login-form'); });
  document.getElementById("auth-back-login-from-reset").addEventListener("click", (e) => { e.preventDefault(); showAuthForm('auth-login-form'); });
  document.getElementById("auth-back-login-from-register").addEventListener("click", (e) => { e.preventDefault(); showAuthForm('auth-login-form'); });

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", () => {
    if (confirm('Sign out of Steve OS?')) {
      window.authSystem.logout();
    }
  });

  // ==================== SYSTEM BOOTSTRAP ====================
  const initApp = () => {
    // Update header role label
    const current = window.authSystem.getCurrentRole();
    if (headerRoleLabel) headerRoleLabel.textContent = current.name;

    setupTheme();
    setupSidebar();
    setupRoleSystem();
    setupSession();
    setupShiftButton();
    renderSidebarPermissions();
    navigateTo(activeView);
  };

  // ==================== THEME SYSTEM ====================
  const setupTheme = () => {
    const isDark = localStorage.getItem("steve_dark_theme") === "true";
    if (isDark) {
      document.body.classList.add("dark-theme");
      if (settingsDarkToggle) settingsDarkToggle.checked = true;
      themeToggle.innerHTML = `<i data-lucide="sun"></i>`;
    } else {
      document.body.classList.remove("dark-theme");
      if (settingsDarkToggle) settingsDarkToggle.checked = false;
      themeToggle.innerHTML = `<i data-lucide="moon"></i>`;
    }
    lucide.createIcons();

    // Bind toggles
    themeToggle.addEventListener("click", toggleTheme);
    if (settingsDarkToggle) {
      settingsDarkToggle.addEventListener("change", (e) => {
        toggleTheme(e.target.checked);
      });
    }
  };

  const toggleTheme = (forceDark = null) => {
    let nextDark = !document.body.classList.contains("dark-theme");
    if (forceDark !== null && typeof forceDark === "boolean") {
      nextDark = forceDark;
    }

    if (nextDark) {
      document.body.classList.add("dark-theme");
      localStorage.setItem("steve_dark_theme", "true");
      themeToggle.innerHTML = `<i data-lucide="sun"></i>`;
      if (settingsDarkToggle) settingsDarkToggle.checked = true;
    } else {
      document.body.classList.remove("dark-theme");
      localStorage.setItem("steve_dark_theme", "false");
      themeToggle.innerHTML = `<i data-lucide="moon"></i>`;
      if (settingsDarkToggle) settingsDarkToggle.checked = false;
    }
    lucide.createIcons();

    // Re-render chart if on analytics/dashboard views
    if (activeView === "dashboard" || activeView === "analytics") {
      renderActiveViewData();
    }
  };

  // ==================== COLLAPSIBLE SIDEBAR ====================
  const setupSidebar = () => {
    // Check if sidebar collapsed state exists
    const collapsed = localStorage.getItem("steve_sidebar_collapsed") === "true";
    if (collapsed) {
      sidebar.classList.add("collapsed");
      sidebarToggle.innerHTML = `<i data-lucide="chevrons-right"></i>`;
    }

    sidebarToggle.addEventListener("click", () => {
      const isCollapsed = sidebar.classList.toggle("collapsed");
      localStorage.setItem("steve_sidebar_collapsed", isCollapsed ? "true" : "false");
      sidebarToggle.innerHTML = isCollapsed 
        ? `<i data-lucide="chevrons-right"></i>`
        : `<i data-lucide="chevrons-left"></i>`;
      lucide.createIcons();
    });

    // Sidebar navigation - document-level delegation (catches all clicks reliably)
    document.addEventListener("click", (e) => {
      let el = e.target;
      while (el && el !== document) {
        if (el.classList && el.classList.contains("menu-item") && el.closest(".sidebar-menu")) {
          e.preventDefault();
          const view = el.getAttribute("data-view");
          if (view) navigateTo(view);
          return;
        }
        el = el.parentNode;
      }
    });
  };

  // ==================== ROLE PERMISSIONS SIMULATION ====================
  const setupRoleSystem = () => {
    // Current role indicator
    const current = window.authSystem.getCurrentRole();
    headerRoleLabel.textContent = current.name;

    // Role Trigger Click
    roleSelectTrigger.addEventListener("click", () => {
      openRoleModal();
    });

    // Close role select modal when clicking outside
    modalRoleSelect.addEventListener("click", (e) => {
      if (e.target === modalRoleSelect) modalRoleSelect.classList.remove("active");
    });
  };

  const openRoleModal = () => {
    const roles = window.authSystem.getAllRoles();
    const currentKey = window.authSystem.getCurrentRoleKey();
    
    roleOptionsList.innerHTML = "";
    Object.entries(roles).forEach(([key, role]) => {
      const activeClass = key === currentKey ? "btn-primary" : "btn-secondary";
      const icon = key === currentKey ? "check" : "circle";
      
      const option = document.createElement("button");
      option.className = `btn ${activeClass} justify-between`;
      option.style.width = "100%";
      option.style.textAlign = "left";
      option.innerHTML = `
        <div style="display:flex; flex-direction:column; text-align:left;">
          <span style="font-weight:600; font-size:0.9rem;">${role.name}</span>
          <span style="font-size:0.75rem; opacity:0.8;">${role.description}</span>
        </div>
        <i data-lucide="${icon}"></i>
      `;

      option.addEventListener("click", () => {
        window.authSystem.setRole(key);
        headerRoleLabel.textContent = role.name;
        modalRoleSelect.classList.remove("active");
        renderSidebarPermissions();
        
        // If current active view is not allowed in next role, navigate to dashboard/first view
        if (!window.authSystem.hasPermission(activeView)) {
          const allowed = role.allowedViews;
          navigateTo(allowed[0] || "dashboard");
        } else {
          navigateTo(activeView);
        }
      });

      roleOptionsList.appendChild(option);
    });

    modalRoleSelect.classList.add("active");
    lucide.createIcons();
  };

  const renderSidebarPermissions = () => {
    const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
    menuItems.forEach(item => {
      const view = item.getAttribute("data-view");
      if (window.authSystem.hasPermission(view)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  };

  // ==================== SHIFT MANAGEMENT ====================
  const setupShiftButton = () => {
    const headerRight = document.querySelector('.header-right');
    let shiftBtn = document.getElementById('shift-toggle-btn');
    if (!shiftBtn) {
      shiftBtn = document.createElement('button');
      shiftBtn.id = 'shift-toggle-btn';
      shiftBtn.style.marginRight = '8px';
      shiftBtn.style.fontSize = '0.75rem';
      // Insert shift button before session controls
      const sessionControls = headerRight.querySelector('.session-controls');
      if (sessionControls) {
        headerRight.insertBefore(shiftBtn, sessionControls);
      } else {
        headerRight.prepend(shiftBtn);
      }
    }
    shiftBtn.className = 'btn btn-primary';

    const updateShiftBtn = () => {
      const db = window.dbManager.get();
      if (db.shiftActive) {
        shiftBtn.innerHTML = '<i data-lucide="stop-circle"></i> End Shift';
        shiftBtn.className = 'btn btn-danger';
      } else {
        shiftBtn.innerHTML = '<i data-lucide="play-circle"></i> Start Shift';
        shiftBtn.className = 'btn btn-primary';
      }
      lucide.createIcons();
    };

    if (shiftBtn.getAttribute('data-listener') === '1') return;
    shiftBtn.setAttribute('data-listener', '1');
    shiftBtn.addEventListener('click', () => {
      const db = window.dbManager.get();
      if (!db.shiftActive) {
        if (db.salesHistory.length > 0) {
          if (!db.shiftHistory) db.shiftHistory = [];
          db.shiftHistory.push({
            endedAt: new Date().toISOString(),
            entries: JSON.parse(JSON.stringify(db.salesHistory))
          });
          db.salesHistory = [];
        }
        db.shiftActive = true;
        shiftBtn.innerHTML = '<i data-lucide="stop-circle"></i> End Shift';
        shiftBtn.className = 'btn btn-danger';
        window.dbManager.save(db);
        checkDailyStockSetup();
        if (window.renderDashboard) window.renderDashboard();
        logActivity('Shift started - previous data archived, profits reset to 0');
      } else {
        if (confirm('End current shift? All pending orders will remain.')) {
          db.shiftActive = false;
          if (db.salesHistory.length > 0) {
            if (!db.shiftHistory) db.shiftHistory = [];
            db.shiftHistory.push({
              endedAt: new Date().toISOString(),
              entries: JSON.parse(JSON.stringify(db.salesHistory))
            });
          }
          db.salesHistory = [];
          localStorage.removeItem("steve_last_stock_setup");
          window.dbManager.save(db);
          shiftBtn.innerHTML = '<i data-lucide="play-circle"></i> Start Shift';
          shiftBtn.className = 'btn btn-primary';
          if (window.renderDashboard) window.renderDashboard();
          logActivity('Shift ended - previous data archived, new shift ready');
        }
      }
      lucide.createIcons();
    });

    updateShiftBtn();
  };

  // ==================== DAILY STARTUP STOCK INVENTORY MODAL ====================
  const checkDailyStockSetup = () => {
    const modal = document.getElementById("modal-daily-stock");
    const container = document.getElementById("daily-stock-inputs-container");
    const db = window.dbManager.get();

    container.innerHTML = "";
    db.rawMaterials.forEach(m => {
      const row = document.createElement("div");
      row.className = "form-group";
      const step = m.unit === 'pcs' ? '1' : '0.1';
      row.innerHTML = `
        <label for="setup-stock-${m.id}">${m.name} (${m.unit})</label>
        <input type="number" step="${step}" id="setup-stock-${m.id}" value="${m.quantity}" class="form-control" required min="0">
      `;
      container.appendChild(row);
    });

    modal.classList.add("active");

    // Remove old listeners
    const newForm = document.getElementById("daily-stock-form").cloneNode(true);
    document.getElementById("daily-stock-form").parentNode.replaceChild(newForm, document.getElementById("daily-stock-form"));

    newForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const inputs = {};
      db.rawMaterials.forEach(m => {
        const val = document.getElementById(`setup-stock-${m.id}`).value;
        inputs[m.id] = m.unit === 'pcs' ? parseInt(val) : parseFloat(val);
      });

      window.inventorySystem.setDailyStock(inputs);
      localStorage.setItem("steve_last_stock_setup", new Date().toISOString().split('T')[0]);
      modal.classList.remove("active");
      renderActiveViewData();
    });
  };

  // Button in inventory view to open stock check manually
  document.getElementById("open-daily-stock-btn").addEventListener("click", () => {
    checkDailyStockSetup();
  });

  // ==================== APP ROUTER (VIEW PANELS) ====================
  const navigateTo = (viewName) => {
    if (!window.authSystem.hasPermission(viewName)) return;

    activeView = viewName;

    // Toggle active sidebar indicator
    document.querySelectorAll(".sidebar-menu .menu-item").forEach(item => {
      if (item.getAttribute("data-view") === viewName) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Toggle view section visibility
    document.querySelectorAll(".view-section").forEach(sec => {
      if (sec.id === `view-${viewName}`) {
        sec.classList.add("active");
      } else {
        sec.classList.remove("active");
      }
    });

    // Set page header title
    const formatted = viewName.replace("-", " ");
    currentViewTitle.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    renderActiveViewData();
  };
  window.navigateTo = navigateTo;

  // Expose render functions globally for voice assistant
  setTimeout(() => {
    window.renderDashboard = renderDashboard;
    window.renderOrders = renderOrders;
    window.renderAttendance = renderAttendance;
    window.renderInventory = renderInventory;
    window.renderSalaries = renderSalaries;
  }, 100);

  // Router dispatcher
  const renderActiveViewData = () => {
    switch (activeView) {
      case "dashboard":
        renderDashboard();
        break;
      case "orders":
        renderOrders();
        break;
      case "inventory":
        renderInventory();
        break;
      case "db-editor":
        renderDbEditor();
        break;
      case "employees":
        renderEmployees();
        break;
      case "attendance":
        renderAttendance();
        break;
      case "salaries":
        renderSalaries();
        break;
      case "analytics":
        renderAnalytics();
        break;
      case "sales-reports":
        renderSalesReports();
        break;
      case "profit-reports":
        renderProfitReports();
        break;
      case "notifications":
        renderNotifications();
        break;
      case "raw-materials":
        renderRawMaterials();
        break;
      case "recipes":
        renderRecipes();
        break;
      case "suppliers":
        renderSuppliers();
        break;
      case "session-log":
        renderSessionLog();
        break;
      case "monthly-summary":
        renderMonthlySummary();
        break;
      case "settings":
        renderSettingsView();
        break;
    }
  };

  // ==================== DASHBOARD PANEL ====================
  const renderDashboard = () => {
    const stats = window.analyticsSystem.getSummaryStats();
    const salaryReport = window.employeeSystem.getSalaryReport(true);
    const totalSalaries = salaryReport.reduce((acc, curr) => acc + curr.totalSalary, 0);
    const netProfitToday = stats.profitToday - totalSalaries;
    const grossProfitToday = stats.profitToday;
    
    document.getElementById("dash-sales-val").textContent = `$${stats.salesToday.toFixed(2)}`;
    
    // Net profit with red color when negative
    const profitEl = document.getElementById("dash-profit-val");
    profitEl.textContent = `$${netProfitToday.toFixed(2)}`;
    profitEl.style.color = netProfitToday < 0 ? 'var(--danger-color)' : '';
    
    document.getElementById("dash-orders-val").textContent = stats.activeOrders;
    document.getElementById("dash-alerts-val").textContent = stats.lowStockAlerts;

    // Total earnings across all shifts (lifetime)
    const fullSalaryReport = window.employeeSystem.getSalaryReport();
    const totalLifetimeSalaries = fullSalaryReport.reduce((acc, curr) => acc + curr.totalSalary, 0);
    const totalNetProfit = stats.totalRevenue - stats.totalCost - totalLifetimeSalaries;
    document.getElementById("dash-total-revenue-val").textContent = `$${stats.totalRevenue.toFixed(2)}`;
    document.getElementById("dash-total-profit-val").textContent = `$${totalNetProfit.toFixed(2)}`;

    const alertTrend = document.getElementById("dash-alerts-trend");
    if (stats.lowStockAlerts > 0) {
      alertTrend.innerHTML = `<i data-lucide="alert-triangle"></i> Critically low items!`;
      alertTrend.className = "stats-trend trend-down";
    } else {
      alertTrend.innerHTML = `<i data-lucide="check-circle-2"></i> All levels healthy`;
      alertTrend.className = "stats-trend trend-up";
    }

    // Live salary deduction indicator
    const profitTrend = document.getElementById("dash-profit-trend");
    if (totalSalaries > 0) {
      profitTrend.innerHTML = `<i data-lucide="clock" style="width:14px;height:14px;"></i> $${totalSalaries.toFixed(2)} salary deducted`;
      profitTrend.className = netProfitToday < 0 ? "stats-trend trend-down" : "stats-trend trend-up";
      profitEl.title = `$${grossProfitToday.toFixed(2)} gross - $${totalSalaries.toFixed(2)} salaries`;
    } else {
      profitTrend.textContent = '';
    }

    // Sales trend
    const salesTrend = document.getElementById("dash-sales-trend");
    if (totalSalaries > 0) {
      salesTrend.textContent = `$${grossProfitToday.toFixed(2)} gross profit before salaries`;
      salesTrend.className = "stats-trend trend-up";
    } else {
      salesTrend.textContent = '';
    }

    // Load line chart using analytics engine (draw last 30 days)
    window.analyticsSystem.renderChart("dashboard-sales-chart", "1month");

    // Load AI Insights list
    const insights = window.aiInsightsSystem.generateInsights();
    const insightsContainer = document.getElementById("dash-ai-insights-list");
    insightsContainer.innerHTML = `
      <div class="bullet-item" style="flex-direction:column; align-items:flex-start; gap:4px;">
        <span class="stats-label" style="font-size:0.75rem;">Profit Leader</span>
        <span class="bullet-text" style="font-weight:600;">${insights.mostProfitableItem}</span>
      </div>
      <div class="bullet-item" style="flex-direction:column; align-items:flex-start; gap:4px;">
        <span class="stats-label" style="font-size:0.75rem;">Fastest Moving stock risk</span>
        <span class="bullet-text" style="color:var(--danger-color); font-weight:600;">${insights.fastestRunningOut}</span>
      </div>
      <div class="bullet-item" style="flex-direction:column; align-items:flex-start; gap:4px;">
        <span class="stats-label" style="font-size:0.75rem;">Peak Hours Activity</span>
        <span class="bullet-text">${insights.peakOrderTimes}</span>
      </div>
      <div class="bullet-item" style="flex-direction:column; align-items:flex-start; gap:4px;">
        <span class="stats-label" style="font-size:0.75rem;">Staff Productivity</span>
        <span class="bullet-text">${insights.productivityInsight}</span>
      </div>
    `;

    // Render top items table
    const topTbody = document.getElementById("dash-top-items-tbody");
    topTbody.innerHTML = "";
    stats.topItems.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.name}</td>
        <td><strong>${item.count} items</strong></td>
      `;
      topTbody.appendChild(tr);
    });

    document.getElementById("dash-staff-summary").textContent = stats.staffSummary;
    const invHealth = document.getElementById("dash-inventory-health");
    if (stats.lowStockAlerts > 0) {
      invHealth.textContent = `${stats.lowStockAlerts} Warnings`;
      invHealth.className = "badge badge-pending";
    } else {
      invHealth.textContent = "Stable";
      invHealth.className = "badge badge-completed";
    }
    
    lucide.createIcons();

    // Auto-refresh every 5 seconds while dashboard is visible
    if (dashRefreshInterval) clearInterval(dashRefreshInterval);
    dashRefreshInterval = setInterval(() => {
      if (activeView === "dashboard") {
        renderDashboard();
      } else {
        clearInterval(dashRefreshInterval);
        dashRefreshInterval = null;
      }
    }, 5000);
  };

  // ==================== LIVE KITCHEN BOARD ====================
  const renderOrders = () => {
    const db = window.dbManager.get();
    const container = document.getElementById("orders-cards-container");
    container.innerHTML = "";

    const activeRole = window.authSystem.getCurrentRoleKey();

    // Filters orders based on filter setting
    let ordersList = db.orders;
    if (activeOrderFilter !== "all") {
      ordersList = db.orders.filter(o => o.status === activeOrderFilter);
    }

    // Chronological order sorting
    ordersList.sort((a,b) => b.id.localeCompare(a.id));

    if (ordersList.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">
          No active orders in the queue.
        </div>
      `;
      return;
    }

    ordersList.forEach(order => {
      const card = document.createElement("div");
      card.className = "order-card";
      
      const itemsHtml = order.items.map(it => `
        <div class="order-item-row">
          <span>${it.quantity}x ${it.name}</span>
          <span style="font-weight:500;">$${(it.price * it.quantity).toFixed(2)}</span>
        </div>
      `).join("");

      let actionBtnHtml = "";
      
      // Control buttons based on role permission
      if (order.status === "pending") {
        if (activeRole === "admin" || activeRole === "manager" || activeRole === "kitchen") {
          actionBtnHtml = `<button class="btn btn-primary" onclick="updateOrderStatus('${order.id}', 'cooking')"><i data-lucide="flame"></i> Cook Order</button>`;
        }
      } else if (order.status === "cooking") {
        if (activeRole === "admin" || activeRole === "manager" || activeRole === "kitchen") {
          actionBtnHtml = `<button class="btn btn-primary" onclick="completeKitchenOrder('${order.id}')"><i data-lucide="check-circle-2"></i> Done</button>`;
        }
      }

      let editBtnHtml = "";
      if (activeRole === "admin" || activeRole === "manager") {
        editBtnHtml = `<button class="btn btn-secondary" onclick="editOrder('${order.id}')"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>`;
      }

      let cancelBtnHtml = "";
      if (order.status !== "completed" && (activeRole === "admin" || activeRole === "manager" || activeRole === "cashier")) {
        cancelBtnHtml = `<button class="btn btn-danger btn-secondary" onclick="cancelOrder('${order.id}')"><i data-lucide="x"></i> Cancel</button>`;
      }

      card.innerHTML = `
        <div>
          <div class="order-header">
            <span class="order-number">Order #${order.id}</span>
            <span class="order-table">${order.table}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">Placed at: ${order.time}</div>
          <div class="order-items-list">
            ${itemsHtml}
          </div>
        </div>
        <div>
          <div class="order-footer">
            <span class="badge badge-${order.status}">${order.status}</span>
            <span class="order-total">$${order.total.toFixed(2)}</span>
          </div>
          <div style="display:flex; gap:8px; margin-top:14px; justify-content:flex-end;">
            ${editBtnHtml}
            ${cancelBtnHtml}
            ${actionBtnHtml}
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Bind click events for filter tabs
    document.querySelectorAll(".order-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".order-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeOrderFilter = btn.getAttribute("data-filter");
        renderOrders();
      });
    });

    lucide.createIcons();
  };

  // Expose global button triggers for live cards
  window.updateOrderStatus = (orderId, nextStatus) => {
    const db = window.dbManager.get();
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
      order.status = nextStatus;
      // When cooking starts, deduct raw materials
      if (nextStatus === 'cooking') {
        order.items.forEach(it => {
          window.inventorySystem.deductIngredients(it.itemId, it.quantity);
        });
      }
      window.dbManager.save(db);
      renderOrders();
      if (window.renderDashboard) window.renderDashboard();
    }
  };

  window.completeKitchenOrder = (orderId) => {
    const db = window.dbManager.get();
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
      order.status = "completed";
      
      // Record sales
      const todayStr = new Date().toISOString().split('T')[0];
      let cost = 0;
      order.items.forEach(it => {
        const menuItem = db.menuItems.find(m => m.id === it.itemId);
        if (menuItem) {
          cost += (menuItem.sellingPrice - menuItem.profit) * it.quantity;
        }
      });
      const profit = order.total - cost;

      const todayEntry = db.salesHistory.find(s => s.date === todayStr);
      if (todayEntry) {
        todayEntry.orders = (todayEntry.orders || 0) + 1;
        todayEntry.revenue = parseFloat(((todayEntry.revenue || 0) + order.total).toFixed(2));
        todayEntry.cost = parseFloat(((todayEntry.cost || 0) + cost).toFixed(2));
        todayEntry.profit = parseFloat(((todayEntry.profit || 0) + profit).toFixed(2));
      } else {
        db.salesHistory.push({
          date: todayStr,
          orders: 1,
          revenue: parseFloat(order.total.toFixed(2)),
          cost: parseFloat(cost.toFixed(2)),
          profit: parseFloat(profit.toFixed(2))
        });
      }

      window.dbManager.save(db);
      renderOrders();
      if (window.renderDashboard) window.renderDashboard();
    }
  };

  window.editOrder = (orderId) => {
    const db = window.dbManager.get();
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return;

    const newTable = prompt('Table / label:', order.table || order.table_label || '');
    if (newTable) {
      order.table = newTable;
      order.table_label = newTable;
    }

    order.items.forEach((item, idx) => {
      const newQty = prompt(`Quantity for "${item.name}":`, item.quantity);
      if (newQty !== null) {
        const qty = parseInt(newQty);
        if (!isNaN(qty) && qty > 0) {
          item.quantity = qty;
        } else if (qty === 0) {
          order.items.splice(idx, 1);
        }
      }
    });

    order.total = parseFloat(order.items.reduce((sum, it) => sum + (it.price * it.quantity), 0).toFixed(2));
    window.dbManager.save(db);
    renderOrders();
  };

  window.cancelOrder = (orderId) => {
    if (confirm(`Cancel Order ${orderId}?`)) {
      const db = window.dbManager.get();
      const orderIndex = db.orders.findIndex(o => o.id === orderId);
      if (orderIndex > -1) {
        const order = db.orders[orderIndex];
        
        if (order.status === "completed" || order.status === "cooking") {
          order.items.forEach(it => {
            window.inventorySystem.restoreIngredients(it.itemId, it.quantity);
          });
        }
        
        db.orders.splice(orderIndex, 1);
        window.dbManager.save(db);
        renderOrders();
        if (window.renderDashboard) window.renderDashboard();
      }
    }
  };

  // ==================== STEVE AI PANEL IN ORDERS ====================
  const setupOrdersSteveAI = () => {
    const sendBtn = document.getElementById("orders-steve-send");
    const input = document.getElementById("orders-steve-input");
    const logsContainer = document.getElementById("orders-steve-logs");

    if (!sendBtn || !input || !logsContainer) return;

    const addLog = (msg, type = 'system') => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 10px; border-radius:6px; font-size:0.8rem; background:' + 
        (type === 'user' ? 'var(--primary-light)' : type === 'error' ? 'rgba(239,68,68,0.1)' : 'var(--bg-secondary)') + ';';
      row.innerHTML = `<span style="font-weight:600;">${type === 'user' ? 'You' : 'Steve'}:</span> ${msg}`;
      logsContainer.appendChild(row);
      logsContainer.scrollTop = logsContainer.scrollHeight;
    };

    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text) return;
      
      // Shift must be active to send assistant commands
      const db = window.dbManager.get();
      if (!db.shiftActive) {
        addLog('Start the shift before placing orders or managing staff.', 'error');
        input.value = '';
        return;
      }

      input.value = '';
      addLog(text, 'user');

      try {
        const resp = await fetch('/api/assistant/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await resp.json();
        if (data.success) {
          addLog(data.response || 'Done.');
          if (data.needsRefresh) {
            if (window.renderOrders) renderOrders();
            if (window.renderInventory) renderInventory();
            if (window.renderDashboard) renderDashboard();
          }
        } else {
          addLog(data.error || 'Error processing request.', 'error');
        }
      } catch (err) {
        addLog('Could not reach server.', 'error');
      }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
  };

  // Initialize Steve AI panel after DOM ready
  setTimeout(setupOrdersSteveAI, 500);

  // ==================== INVENTORY VIEW ====================
  const renderInventory = () => {
    const predictions = window.inventorySystem.getPredictions();
    const tbody = document.getElementById("inventory-tbody");
    tbody.innerHTML = "";

    predictions.forEach(p => {
      const db = window.dbManager.get();
      const material = db.rawMaterials.find(m => m.id === p.id);
      
      const tr = document.createElement("tr");
      let depletionMsg = `${p.hoursRemaining} hours`;
      if (p.hoursRemaining > 48) depletionMsg = "Stable (> 2 Days)";
      
      let statusBadge = `<span class="badge badge-completed">Healthy</span>`;
      if (p.status === "critical") {
        statusBadge = `<span class="badge badge-danger">Critical</span>`;
      } else if (p.status === "warning") {
        statusBadge = `<span class="badge badge-pending">Warning</span>`;
      }

      // Restock advice text
      let advice = "No procurement required.";
      if (p.status === "critical" || p.status === "warning") {
        const orderQty = Math.ceil(material.minStock * 2);
        advice = `Order ${orderQty} ${p.unit} immediately.`;
      }

      tr.innerHTML = `
        <td><strong>${p.name}</strong></td>
        <td>${p.currentStock.toFixed(2)} ${p.unit}</td>
        <td>${material.minStock} ${p.unit}</td>
        <td>${depletionMsg}</td>
        <td>${statusBadge}</td>
        <td style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">${advice}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  // ==================== DATABASE WORKER EDITOR ====================
  const renderDbEditor = () => {
    const db = window.dbManager.get();
    const tbody = document.getElementById("db-editor-tbody");
    tbody.innerHTML = "";

    db.menuItems.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-size:2rem; width:80px; text-align:center;">${item.icon || '🍔'}</td>
        <td><strong>${item.name}</strong></td>
        <td>${item.category}</td>
        <td>$${item.sellingPrice.toFixed(2)}</td>
        <td>${item.prepTime} min</td>
        <td>$${item.profit.toFixed(2)}</td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" style="padding:4px 8px;" onclick="editMenuItem('${item.id}')"><i data-lucide="pencil" style="width:14px; height:14px;"></i></button>
            <button class="btn btn-danger" style="padding:4px 8px;" onclick="deleteMenuItem('${item.id}')"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    lucide.createIcons();
  };

  const modalAddItem = document.getElementById("modal-add-item");
  const openAddItemBtn = document.getElementById("open-add-item-modal-btn");
  const closeAddItemBtn = document.getElementById("close-add-item-modal");
  const addItemForm = document.getElementById("add-item-form");

  function populateRecipeIngredients(editItem) {
    const db = window.dbManager.get();
    const recContainer = document.getElementById("recipe-ingredients-inputs");
    recContainer.innerHTML = "";

    db.rawMaterials.forEach(m => {
      const isChecked = editItem && editItem.recipe && editItem.recipe.some(r => r.materialId === m.id);
      const recipeQty = editItem && editItem.recipe ? (editItem.recipe.find(r => r.materialId === m.id) || {}).quantity : '';
      
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.padding = "6px";
      row.style.borderBottom = "1px solid var(--border-color)";
      
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="add-recipe-check-${m.id}" data-mid="${m.id}" class="ingredient-check" ${isChecked ? 'checked' : ''}>
          <label for="add-recipe-check-${m.id}">${m.name}</label>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <input type="number" step="0.01" id="add-recipe-qty-${m.id}" placeholder="Qty" class="form-control" style="width:70px; padding:4px;" ${isChecked ? '' : 'disabled'} value="${recipeQty}">
          <span style="font-size:0.75rem; color:var(--text-muted);">${m.unit}</span>
        </div>
      `;

      const check = row.querySelector(".ingredient-check");
      const qty = row.querySelector("input[type=number]");
      check.addEventListener("change", () => {
        qty.disabled = !check.checked;
        if (check.checked) qty.required = true;
        else { qty.required = false; qty.value = ""; }
      });

      recContainer.appendChild(row);
    });
  }

  if (openAddItemBtn) {
    openAddItemBtn.addEventListener("click", () => {
      document.getElementById("item-edit-id").value = '';
      document.getElementById("item-modal-title").textContent = 'Add Database Menu Item';
      document.getElementById("item-name").value = '';
      document.getElementById("item-category").value = 'Burgers';
      document.getElementById("item-price").value = '';
      document.getElementById("item-prep").value = '';
      document.getElementById("item-icon").value = '';
      document.getElementById("item-instructions").value = '';
      populateRecipeIngredients(null);
      modalAddItem.classList.add("active");
    });
  }

  if (closeAddItemBtn) {
    closeAddItemBtn.addEventListener("click", () => modalAddItem.classList.remove("active"));
  }

  if (addItemForm) {
    addItemForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const db = window.dbManager.get();
      const editId = document.getElementById("item-edit-id").value;

      const name = document.getElementById("item-name").value;
      const category = document.getElementById("item-category").value;
      const price = parseFloat(document.getElementById("item-price").value);
      const prep = parseInt(document.getElementById("item-prep").value);
      const icon = document.getElementById("item-icon").value || "🍔";
      const instructions = document.getElementById("item-instructions").value;

      const recipe = [];
      let totalCost = 0;
      
      db.rawMaterials.forEach(m => {
        const check = document.getElementById(`add-recipe-check-${m.id}`);
        const qtyVal = document.getElementById(`add-recipe-qty-${m.id}`).value;
        if (check && check.checked) {
          const qty = parseFloat(qtyVal);
          recipe.push({ materialId: m.id, quantity: qty });
          totalCost += (qty * m.costPerUnit);
        }
      });

      const profit = parseFloat((price - totalCost).toFixed(2));

      if (editId) {
        const item = db.menuItems.find(i => i.id === editId);
        if (item) {
          item.name = name;
          item.category = category;
          item.sellingPrice = price;
          item.prepTime = prep;
          item.icon = icon;
          item.instructions = instructions;
          item.recipe = recipe;
          item.profit = profit;
        }
      } else {
        db.menuItems.push({
          id: "m" + (db.menuItems.length + 1),
          name, category, sellingPrice: price, prepTime: prep,
          icon, recipe, instructions, profit
        });
      }

      window.dbManager.save(db);
      modalAddItem.classList.remove("active");
      addItemForm.reset();
      renderDbEditor();
    });
  }

  window.editMenuItem = (id) => {
    const db = window.dbManager.get();
    const item = db.menuItems.find(i => i.id === id);
    if (!item) return;
    document.getElementById("item-edit-id").value = item.id;
    document.getElementById("item-modal-title").textContent = 'Edit Menu Item';
    document.getElementById("item-name").value = item.name;
    document.getElementById("item-category").value = item.category;
    document.getElementById("item-price").value = item.sellingPrice;
    document.getElementById("item-prep").value = item.prepTime;
    document.getElementById("item-icon").value = item.icon || '';
    document.getElementById("item-instructions").value = item.instructions || '';
    populateRecipeIngredients(item);
    modalAddItem.classList.add("active");
  };

  window.deleteMenuItem = (itemId) => {
    if (confirm("Delete this food item?")) {
      const db = window.dbManager.get();
      const itemIndex = db.menuItems.findIndex(m => m.id === itemId);
      if (itemIndex > -1) {
        const name = db.menuItems[itemIndex].name;
        db.menuItems.splice(itemIndex, 1);
        window.dbManager.save(db);
        renderDbEditor();
      }
    }
  };

  // ==================== EMPLOYEES DIRECTORY ====================
  const renderEmployees = () => {
    const db = window.dbManager.get();
    const tbody = document.getElementById("employees-tbody");
    tbody.innerHTML = "";

    db.employees.forEach(emp => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${emp.name}</strong></td>
        <td>${emp.role}</td>
        <td>$${emp.hourlyRate.toFixed(2)}/hr</td>
        <td>${emp.shift}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="background:var(--border-color); height:6px; width:80px; border-radius:10px; overflow:hidden;">
              <div style="background:var(--primary-color); height:100%; width:${(emp.rating * 20)}%;"></div>
            </div>
            <span>${(emp.rating * 20).toFixed(0)}%</span>
          </div>
        </td>
        <td>${emp.performance}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="editEmployee('${emp.id}')"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
            <button class="btn btn-danger" style="padding:4px 8px;font-size:0.75rem;" onclick="deleteEmployee('${emp.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    lucide.createIcons();
  };

  const modalAddEmp = document.getElementById("modal-add-employee");
  const openAddEmpBtn = document.getElementById("open-add-employee-modal-btn");
  const closeAddEmpBtn = document.getElementById("close-add-emp-modal");
  const addEmpForm = document.getElementById("add-employee-form");

  if (openAddEmpBtn) {
    openAddEmpBtn.addEventListener("click", () => {
      document.getElementById("emp-edit-id").value = '';
      document.getElementById("emp-modal-title").textContent = 'Onboard New Employee';
      document.getElementById("emp-save-btn").textContent = 'Save Employee';
      document.getElementById("emp-name").value = '';
      document.getElementById("emp-role").value = 'Chef';
      document.getElementById("emp-rate").value = '';
      document.getElementById("emp-shift").value = '08:00 - 16:00';
      modalAddEmp.classList.add("active");
    });
  }
  if (closeAddEmpBtn) {
    closeAddEmpBtn.addEventListener("click", () => modalAddEmp.classList.remove("active"));
  }

  if (addEmpForm) {
    addEmpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const editId = document.getElementById("emp-edit-id").value;
      const name = document.getElementById("emp-name").value;
      const role = document.getElementById("emp-role").value;
      const rate = parseFloat(document.getElementById("emp-rate").value);
      const shift = document.getElementById("emp-shift").value;

      if (editId) {
        window.employeeSystem.updateEmployee(editId, { name, role, hourlyRate: rate, shift });
      } else {
        window.employeeSystem.addEmployee({ name, role, hourlyRate: rate, shift });
      }
      modalAddEmp.classList.remove("active");
      addEmpForm.reset();
      renderEmployees();
    });
  }

  window.editEmployee = (id) => {
    const db = window.dbManager.get();
    const emp = db.employees.find(e => e.id === id);
    if (!emp) return;
    document.getElementById("emp-edit-id").value = emp.id;
    document.getElementById("emp-modal-title").textContent = 'Edit Employee';
    document.getElementById("emp-save-btn").textContent = 'Update Employee';
    document.getElementById("emp-name").value = emp.name;
    document.getElementById("emp-role").value = emp.role;
    document.getElementById("emp-rate").value = emp.hourlyRate;
    document.getElementById("emp-shift").value = emp.shift;
    modalAddEmp.classList.add("active");
  };

  window.deleteEmployee = (id) => {
    if (!confirm('Delete this employee?')) return;
    const db = window.dbManager.get();
    db.employees = db.employees.filter(e => e.id !== id);
    delete db.attendance[new Date().toISOString().split('T')[0]];
    window.dbManager.save(db);
    renderEmployees();
  };

  // ==================== ATTENDANCE LOGGER ====================
  const renderAttendance = () => {
    const attendance = window.employeeSystem.getTodayAttendance();
    const tbody = document.getElementById("attendance-tbody");
    tbody.innerHTML = "";

    attendance.forEach(att => {
      const tr = document.createElement("tr");
      
      let badgeClass = "badge-pending";
      if (att.status === "present") badgeClass = "badge-completed";
      else if (att.status === "late") badgeClass = "badge-pending";
      else if (att.status === "absent") badgeClass = "badge-danger";

      let actionHtml = "";
      if (att.status === "unmarked" || att.status === "absent") {
        actionHtml = `<button class="btn btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="markStaffPresent('${att.id}', 'present')">Mark Present</button>`;
      } else if (att.status === "present" || att.status === "late") {
        if (!att.timeOut) {
          actionHtml = `<button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="clockOutStaff('${att.id}')">Clock Out</button>`;
        } else {
          actionHtml = `<span style="font-size:0.75rem; color:var(--text-muted);">Completed</span>`;
        }
      }

      tr.innerHTML = `
        <td><strong>${att.name}</strong></td>
        <td>${att.shift}</td>
        <td><span class="badge ${badgeClass}">${att.status}</span></td>
        <td>${att.timeIn || '—'}</td>
        <td>${att.timeOut || '—'}</td>
        <td>${actionHtml}</td>
      `;
      tbody.appendChild(tr);
    });

    // Populate biometric selector
    const bioSelect = document.getElementById("biometric-employee-select");
    const db = window.dbManager.get();
    bioSelect.innerHTML = "";
    db.employees.forEach(emp => {
      const option = document.createElement("option");
      option.value = emp.id;
      option.textContent = `${emp.name} (${emp.role})`;
      bioSelect.appendChild(option);
    });
  };

  window.markStaffPresent = (empId, status) => {
    const result = window.employeeSystem.markAttendance(empId, status);
    if (result.success) {
      renderAttendance();
    } else {
      alert(result.message);
    }
  };

  window.clockOutStaff = (empId) => {
    const success = window.employeeSystem.clockOut(empId);
    if (success) {
      renderAttendance();
    } else {
      const db = window.dbManager.get();
      if (!db.shiftActive) alert('Start the shift before clocking out.');
    }
  };

  // Biometric simulation binds
  document.getElementById("biometric-clockin-btn").addEventListener("click", () => {
    const empId = document.getElementById("biometric-employee-select").value;
    const result = window.employeeSystem.markAttendance(empId, "present");
    if (result.success) {
      renderAttendance();
    } else {
      alert(result.message);
    }
  });

  document.getElementById("biometric-clockout-btn").addEventListener("click", () => {
    const empId = document.getElementById("biometric-employee-select").value;
    const success = window.employeeSystem.clockOut(empId);
    if (success) {
      renderAttendance();
    } else {
      const db = window.dbManager.get();
      if (!db.shiftActive) alert('Start the shift before clocking out.');
    }
  });

  // ==================== PAYROLL SALARIES PANEL ====================
  const renderSalaries = () => {
    const report = window.employeeSystem.getSalaryReport();
    const tbody = document.getElementById("salaries-tbody");
    tbody.innerHTML = "";

    report.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${row.name}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${row.role}</span></td>
        <td>$${row.hourlyRate.toFixed(2)}/hr</td>
        <td>${row.actualHours} hrs</td>
        <td>${row.overtimeHours} hrs</td>
        <td>${row.presentDays}d / ${row.absentDays}a</td>
        <td>$${row.baseSalary.toFixed(2)}</td>
        <td>$${row.overtimeSalary.toFixed(2)}</td>
        <td><strong>$${row.totalSalary.toFixed(2)}</strong></td>
        <td><button class="btn btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="editSalary('${row.id}')"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button></td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById("process-salaries-btn").addEventListener("click", () => {
      alert("Salaries successfully processed and sent to bank API endpoints!");
    });
  };

  window.editSalary = (empId) => {
    const db = window.dbManager.get();
    const emp = db.employees.find(e => e.id === empId);
    if (!emp) return alert('Employee not found.');
    document.getElementById("salary-edit-id").value = emp.id;
    document.getElementById("salary-employee-name").value = emp.name;
    document.getElementById("salary-hourly-rate").value = emp.hourlyRate;
    document.getElementById("salary-overtime-hours").value = emp.overtimeHours || 0;
    document.getElementById("salary-present-days").value = emp.salaryPresentDays != null ? emp.salaryPresentDays : 0;
    document.getElementById("salary-absent-days").value = emp.salaryAbsentDays != null ? emp.salaryAbsentDays : 0;
    document.getElementById("salary-late-days").value = emp.salaryLateDays != null ? emp.salaryLateDays : 0;
    document.getElementById("modal-edit-salary").classList.add("active");
  };

  document.getElementById("close-edit-salary-modal")?.addEventListener("click", () => {
    document.getElementById("modal-edit-salary").classList.remove("active");
  });

  document.getElementById("edit-salary-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const db = window.dbManager.get();
    const id = document.getElementById("salary-edit-id").value;
    const emp = db.employees.find(e => e.id === id);
    if (!emp) return;
    emp.hourlyRate = parseFloat(document.getElementById("salary-hourly-rate").value);
    emp.overtimeHours = parseFloat(document.getElementById("salary-overtime-hours").value) || 0;
    emp.salaryPresentDays = parseInt(document.getElementById("salary-present-days").value) || 0;
    emp.salaryAbsentDays = parseInt(document.getElementById("salary-absent-days").value) || 0;
    emp.salaryLateDays = parseInt(document.getElementById("salary-late-days").value) || 0;
    window.dbManager.save(db);
    document.getElementById("modal-edit-salary").classList.remove("active");
    renderSalaries();
  });

  document.getElementById("modal-edit-salary")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-edit-salary")) {
      document.getElementById("modal-edit-salary").classList.remove("active");
    }
  });

  // ==================== ANALYTICS GRAPH SHEETS ====================
  const renderAnalytics = () => {
    const stats = window.analyticsSystem.getSummaryStats();
    document.getElementById("stats-total-rev").textContent = `$${stats.totalRevenue.toFixed(2)}`;
    document.getElementById("stats-total-prof").textContent = `$${stats.totalProfit.toFixed(2)}`;

    // Draw main analytics line graph (default 30 days)
    window.analyticsSystem.renderChart("analytics-sales-chart", "1month");

    // Period selectors triggers
    document.querySelectorAll(".period-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".period-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const period = btn.getAttribute("data-period");
        window.analyticsSystem.renderChart("analytics-sales-chart", period);
      });
    });
  };

  // ==================== FINANCIAL REPORTS LOGS ====================
  const renderSalesReports = () => {
    const db = window.dbManager.get();
    const tbody = document.getElementById("sales-reports-tbody");
    tbody.innerHTML = "";

    // Group completed orders by date
    const dailyData = {};
    db.orders.filter(o => o.status === "completed").forEach(order => {
      if (!dailyData[order.date]) dailyData[order.date] = { orders: 0, revenue: 0, cost: 0, profit: 0 };
      dailyData[order.date].orders++;
      dailyData[order.date].revenue += order.total;
      order.items.forEach(item => {
        const mi = db.menuItems.find(m => m.id === item.itemId);
        if (mi) {
          dailyData[order.date].profit += mi.profit * item.quantity;
          dailyData[order.date].cost += (mi.sellingPrice - mi.profit) * item.quantity;
        }
      });
    });

    // Sort by date descending
    const sortedDates = Object.keys(dailyData).sort().reverse();
    sortedDates.forEach(date => {
      const d = dailyData[date];
      const tr = document.createElement("tr");
      const isToday = date === new Date().toISOString().split('T')[0];
      tr.innerHTML = `
        <td><strong>${date}${isToday ? ' (Today)' : ''}</strong></td>
        <td>${d.orders} orders</td>
        <td>$${d.revenue.toFixed(2)}</td>
        <td>$${d.cost.toFixed(2)}</td>
        <td>$${d.profit.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });

    if (sortedDates.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No completed orders yet.</td></tr>';
    }

    document.getElementById("export-sales-csv-btn").addEventListener("click", () => {
      window.analyticsSystem.exportToCSV("sales");
    });

    // Render archived shift history
    const shiftTbody = document.getElementById("shift-history-tbody");
    if (shiftTbody) {
      shiftTbody.innerHTML = "";
      if (db.shiftHistory && db.shiftHistory.length > 0) {
        db.shiftHistory.slice().reverse().forEach(shift => {
          shift.entries.forEach(entry => {
            const tr = document.createElement("tr");
            const ended = new Date(shift.endedAt);
            const timeStr = ended.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            tr.innerHTML = `
              <td><strong>${timeStr}</strong></td>
              <td>${entry.date}</td>
              <td>${entry.orders} orders</td>
              <td>$${entry.revenue.toFixed(2)}</td>
              <td>$${entry.cost.toFixed(2)}</td>
              <td>$${entry.profit.toFixed(2)}</td>
            `;
            shiftTbody.appendChild(tr);
          });
        });
      } else {
        shiftTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No archived shifts yet.</td></tr>';
      }
    }
  };

  // Auto-refresh handles for live updates
  let dashRefreshInterval = null;
  let profitRefreshInterval = null;

  const renderProfitReports = () => {
    const stats = window.analyticsSystem.getSummaryStats();
    const salaryReport = window.employeeSystem.getSalaryReport();
    const totalSalaries = salaryReport.reduce((acc, curr) => acc + curr.totalSalary, 0);
    const netProfit = stats.totalRevenue - stats.totalCost - totalSalaries;
    const liveCount = salaryReport.filter(r => r.actualHours > 0).length;

    const tbody = document.getElementById("profit-reports-tbody");
    tbody.innerHTML = `
      <tr>
        <td><strong>Revenue Group</strong></td>
        <td>Lifetime Restaurant Gross Sales Volume</td>
        <td><strong style="color:var(--success-color);">$${stats.totalRevenue.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td><strong>Cost of Goods (COGS)</strong></td>
        <td>Raw materials and kitchen ingredients consumed</td>
        <td><strong style="color:var(--danger-color);">-$${stats.totalCost.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td><strong>Salaries Expense</strong></td>
        <td>Employee salaries based on actual clock hours ${liveCount > 0 ? '<span class="badge badge-processing" style="margin-left:8px;">LIVE</span>' : ''}</td>
        <td><strong style="color:var(--danger-color);">-$${totalSalaries.toFixed(2)}</strong></td>
      </tr>
      <tr style="border-top: 2px solid var(--border-color); background:var(--primary-light);">
        <td><strong>Net Profit</strong></td>
        <td>Revenue minus costs and salaries</td>
        <td><strong>$${netProfit.toFixed(2)}</strong></td>
      </tr>
    `;

    document.getElementById("export-profit-csv-btn").addEventListener("click", () => {
      window.analyticsSystem.exportToCSV("profit");
    });

    // Auto-refresh every 60 seconds while this view is visible
    if (profitRefreshInterval) clearInterval(profitRefreshInterval);
    profitRefreshInterval = setInterval(() => {
      if (activeView === "profit-reports") {
        renderProfitReports();
      } else {
        clearInterval(profitRefreshInterval);
        profitRefreshInterval = null;
      }
    }, 60000);
  };

  // ==================== SYSTEM NOTIFICATIONS PANEL ====================
  const renderNotifications = () => {
    const alerts = window.inventorySystem.getAlerts();
    const container = document.getElementById("notifications-list");
    container.innerHTML = "";

    // Seed visual notifications if alerts empty
    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="bullet-item">
          <span class="bullet-text" style="color:var(--text-secondary);"><i data-lucide="check-circle-2" style="vertical-align:middle; margin-right:8px; color:var(--success-color);"></i> All inventory lines are operating within safety parameters.</span>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    alerts.forEach(alert => {
      const row = document.createElement("div");
      
      let badge = `<span class="badge badge-pending">Warning</span>`;
      let rowBg = '';
      if (alert.type === "critical") {
        badge = `<span class="badge badge-danger">Critical</span>`;
        rowBg = 'background: rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3);';
      } else if (alert.type === "warning") {
        rowBg = 'background: rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2);';
      }
      row.className = "bullet-item";
      row.style.cssText = rowBg;

      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          ${badge}
          <span class="bullet-text" style="font-weight:500;">${alert.message}</span>
        </div>
        <span style="font-size:0.75rem; color:var(--text-muted);">Just now</span>
      `;
      container.appendChild(row);
    });

    document.getElementById("clear-notifications-btn").addEventListener("click", () => {
      localStorage.setItem("steve_stock_alerts", "[]");
      renderNotifications();
      renderDashboard(); // Update stats low stock counts
    });

    lucide.createIcons();
  };

  // ==================== RAW MATERIALS WITH EDIT ====================
  const renderRawMaterials = () => {
    const db = window.dbManager.get();
    const tbody = document.getElementById("raw-materials-tbody");
    tbody.innerHTML = "";
    db.rawMaterials.forEach(m => {
      const tr = document.createElement("tr");
      const badgeClass = m.quantity <= m.minStock ? 'badge-danger' : 'badge-completed';
      tr.innerHTML = `
        <td><code>${m.id}</code></td>
        <td><strong>${m.name}</strong></td>
        <td>${m.type}</td>
        <td><code>${m.unit}</code></td>
        <td>$${m.costPerUnit.toFixed(2)}</td>
        <td><span class="badge ${badgeClass}">${m.quantity} ${m.unit}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="editRawMaterial('${m.id}')"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
            <button class="btn btn-danger" style="padding:4px 8px;font-size:0.75rem;" onclick="deleteRawMaterial('${m.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    lucide.createIcons();
  };

  document.getElementById("add-raw-material-btn")?.addEventListener("click", () => {
    const db = window.dbManager.get();
    const newName = prompt('Material name:');
    if (!newName) return;
    const newType = prompt('Storage type (Frozen, Dairy, Produce, etc.):', 'Frozen');
    const newUnit = prompt('Measurement unit (pcs, cups, lbs, liters):', 'pcs');
    const newCost = parseFloat(prompt('Cost per unit ($):', '1.00')) || 1;
    const newMinStock = parseFloat(prompt('Min stock level:', '10')) || 10;
    const newQty = parseFloat(prompt('Initial quantity:', '50')) || 50;
    const newId = 'rm' + (db.rawMaterials.length + 1);
    db.rawMaterials.push({
      id: newId,
      name: newName,
      type: newType || 'Frozen',
      unit: newUnit || 'pcs',
      costPerUnit: newCost,
      minStock: newMinStock,
      quantity: newUnit === 'pcs' ? parseInt(newQty) : newQty
    });
    window.dbManager.save(db);
    renderRawMaterials();
  });

  window.editRawMaterial = (id) => {
    const db = window.dbManager.get();
    const mat = db.rawMaterials.find(m => m.id === id);
    if (!mat) return;
    const newName = prompt('Material name:', mat.name);
    if (newName) mat.name = newName;
    const newType = prompt('Storage type:', mat.type);
    if (newType) mat.type = newType;
    const newUnit = prompt('Measurement unit:', mat.unit);
    if (newUnit) mat.unit = newUnit;
    const newCost = prompt('Cost per unit ($):', mat.costPerUnit);
    if (newCost) mat.costPerUnit = parseFloat(newCost);
    const newMinStock = prompt('Min stock level:', mat.minStock);
    if (newMinStock) mat.minStock = parseFloat(newMinStock);
    const newQty = prompt('Current quantity:', mat.quantity);
    if (newQty) mat.quantity = mat.unit === 'pcs' ? parseInt(newQty) : parseFloat(newQty);
    window.dbManager.save(db);
    renderRawMaterials();
  };

  window.deleteRawMaterial = (id) => {
    if (!confirm('Delete this raw material? It may affect recipes using it.')) return;
    const db = window.dbManager.get();
    const mat = db.rawMaterials.find(m => m.id === id);
    db.rawMaterials = db.rawMaterials.filter(m => m.id !== id);
    window.dbManager.save(db);
    renderRawMaterials();
    if (mat) logActivity("Raw material '" + mat.name + "' deleted");
  };

  // ==================== RECIPES ACCORDION ====================
  const renderRecipes = () => {
    const db = window.dbManager.get();
    const container = document.getElementById("recipes-accordion-list");
    container.innerHTML = "";
    db.menuItems.forEach(item => {
      const card = document.createElement("div");
      card.className = "bullet-item";
      card.style.flexDirection = "column";
      card.style.alignItems = "flex-start";
      card.style.gap = "8px";
      card.style.padding = "16px";
      const ingredientsList = item.recipe.map(req => {
        const material = db.rawMaterials.find(m => m.id === req.materialId);
        return `<li>${material ? material.name : req.materialId}: <strong>${req.quantity} ${material ? material.unit : ''}</strong></li>`;
      }).join("");
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:4px;">
          <span style="font-weight:600; font-size:1.05rem;" class="bullet-text">${item.icon || '🍔'} ${item.name}</span>
          <div style="display:flex; gap:6px; align-items:center;">
            <span class="badge badge-completed">Prep Time: ${item.prepTime} mins</span>
            <button class="btn btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="editRecipeFromRecipes('${item.id}')"><i data-lucide="pencil" style="width:14px;height:14px;"></i> Edit</button>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1.5fr; gap:20px; width:100%; margin-top:8px;">
          <div>
            <span class="stats-label" style="font-size:0.75rem; display:block; margin-bottom:6px;">Required Ingredients</span>
            <ul style="padding-left:16px; font-size:0.85rem; display:flex; flex-direction:column; gap:4px; color:var(--text-secondary);">
              ${ingredientsList}
            </ul>
          </div>
          <div>
            <span class="stats-label" style="font-size:0.75rem; display:block; margin-bottom:6px;">Instructions</span>
            <p style="font-size:0.85rem; line-height:1.4; color:var(--text-secondary);">${item.instructions || 'No instructions written.'}</p>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  };

  // ==================== SUPPLIERS DIRECTORY ====================
  const renderSuppliers = () => {
    const db = window.dbManager.get();
    const tbody = document.getElementById("suppliers-tbody");
    tbody.innerHTML = "";
    db.suppliers.forEach(sup => {
      const tr = document.createElement("tr");
      const materialsText = typeof sup.materials === 'string' ? sup.materials : (Array.isArray(sup.materials) ? sup.materials.join(", ") : "");
      tr.innerHTML = `
        <td><strong>${sup.name}</strong></td>
        <td>${sup.contact}</td>
        <td>${materialsText}</td>
        <td><span class="badge badge-completed" style="font-size:0.8rem;">${sup.terms || sup.paymentTerms || '-'}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="openEditSupplierModal('${sup.id}')"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
            <button class="btn btn-danger" style="padding:4px 8px;font-size:0.75rem;" onclick="deleteSupplier('${sup.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    lucide.createIcons();
  };

  // ==================== MONTHLY REPORT PROJECTOR ====================
  const renderMonthlySummary = () => {
    const stats = window.analyticsSystem.getSummaryStats();
    const salaryReport = window.employeeSystem.getSalaryReport();
    const totalSalaries = salaryReport.reduce((acc, curr) => acc + curr.totalSalary, 0);
    const netVal = stats.totalRevenue - stats.totalCost - totalSalaries;

    document.getElementById("monthly-summary-sales").textContent = `$${stats.totalRevenue.toFixed(2)}`;
    document.getElementById("monthly-summary-cost").textContent = `$${stats.totalCost.toFixed(2)}`;
    document.getElementById("monthly-summary-salaries").textContent = `$${totalSalaries.toFixed(2)}`;
    
    const netEl = document.getElementById("monthly-summary-net");
    netEl.textContent = `$${netVal.toFixed(2)}`;
    
    if (netVal < 0) {
      netEl.className = "badge badge-danger";
    } else {
      netEl.className = "badge badge-completed";
    }

    // CSV Download
    document.getElementById("download-summary-excel").addEventListener("click", () => {
      window.analyticsSystem.exportToCSV("profit");
    });

    // PDF Download mock
    document.getElementById("download-summary-pdf").addEventListener("click", () => {
      window.print(); // Prints clean viewport
    });
  };

  // ==================== SETTINGS VIEW ====================
  const renderSettingsView = () => {
    document.getElementById("factory-reset-btn").addEventListener("click", () => {
      if (confirm("WARNING: Are you sure you want to restore defaults? This will erase all custom menus, employee lists, shift and inventory baseline records.")) {
        window.dbManager.reset();
        // Clear all app data but keep user logged in
        ['steve_stock_alerts', 'steve_session_log', 'steve_theme', 'steve_chat_history'].forEach(k => localStorage.removeItem(k));
        navigateTo("dashboard");
        alert("Factory reset complete. All data restored to defaults.");
      }
    });

    const launchBtn = document.getElementById("launch-voice-assistant-btn");
    if (launchBtn) {
      launchBtn.addEventListener("click", async () => {
        launchBtn.disabled = true;
        launchBtn.textContent = "Launching...";
        try {
          const res = await fetch("/api/assistant/launch", { method: "POST" });
          const data = await res.json();
          if (data.success) {
            document.getElementById("voice-assistant-status").textContent = "Running";
            document.getElementById("voice-assistant-status").className = "badge badge-processing";
          } else {
            alert("Failed: " + (data.error || "Unknown error"));
          }
        } catch (err) {
          alert("Could not connect to server.");
        }
        launchBtn.disabled = false;
        launchBtn.innerHTML = '<i data-lucide="mic"></i> Launch Assistant';
        try { lucide.createIcons(); } catch (e) {}
      });
    }
  };

  // ==================== SESSION MANAGEMENT ====================
  const setupSession = () => {
    if (!localStorage.getItem("steve_session_log")) {
      localStorage.setItem("steve_session_log", JSON.stringify([]));
    }
    updateSessionUI();

    document.getElementById("session-start-btn").addEventListener("click", () => {
      const log = JSON.parse(localStorage.getItem("steve_session_log") || "[]");
      if (log.length > 0 && !log[log.length-1].endTime) {
        alert("Session already running.");
        return;
      }
      const entry = { startTime: new Date().toISOString(), endTime: null, orders: 0 };
      log.push(entry);
      localStorage.setItem("steve_session_log", JSON.stringify(log));
      updateSessionUI();
      logActivity("Session started");
    });

    document.getElementById("session-stop-btn").addEventListener("click", () => {
      const log = JSON.parse(localStorage.getItem("steve_session_log") || "[]");
      const current = log.find(e => !e.endTime);
      if (!current) {
        alert("No active session to stop.");
        return;
      }
      current.endTime = new Date().toISOString();
      current.orders = (window.dbManager.get().orders || []).filter(o => {
        const oTime = new Date(o.date + "T" + o.time);
        const sTime = new Date(current.startTime);
        return oTime >= sTime;
      }).length;
      localStorage.setItem("steve_session_log", JSON.stringify(log));
      updateSessionUI();
      logActivity("Session stopped — " + current.orders + " orders processed");
    });
  };

  const updateSessionUI = () => {
    const log = JSON.parse(localStorage.getItem("steve_session_log") || "[]");
    const active = log.find(e => !e.endTime);
    const badge = document.getElementById("session-status-badge");
    if (badge) {
      if (active) {
        const elapsed = Math.floor((Date.now() - new Date(active.startTime)) / 60000);
        badge.textContent = "Running " + elapsed + "m";
        badge.className = "badge badge-processing";
      } else {
        const last = log.length > 0 ? log[log.length-1] : null;
        if (last && last.endTime) {
          const duration = Math.floor((new Date(last.endTime) - new Date(last.startTime)) / 60000);
          badge.textContent = "Last: " + duration + "m";
        } else {
          badge.textContent = "Stopped";
        }
        badge.className = "badge badge-completed";
      }
    }
  };

  const logActivity = (msg) => {
    const log = JSON.parse(localStorage.getItem("steve_activity_log") || "[]");
    log.push({ time: new Date().toISOString(), message: msg });
    localStorage.setItem("steve_activity_log", JSON.stringify(log));
  };

  const renderSessionLog = () => {
    const log = JSON.parse(localStorage.getItem("steve_session_log") || "[]");
    const container = document.getElementById("session-log-list");
    container.innerHTML = "";

    if (log.length === 0) {
      container.innerHTML = '<div class="bullet-item"><span class="bullet-text" style="color:var(--text-muted);">No sessions recorded yet.</span></div>';
      return;
    }

    log.slice().reverse().forEach((entry, idx) => {
      const div = document.createElement("div");
      div.className = "bullet-item";
      const start = new Date(entry.startTime).toLocaleString();
      let info = `<span class="bullet-text"><strong>Session ${log.length - idx}</strong> — Started: ${start}`;
      if (entry.endTime) {
        const end = new Date(entry.endTime).toLocaleString();
        const duration = Math.floor((new Date(entry.endTime) - new Date(entry.startTime)) / 60000);
        info += `<br>Ended: ${end} | Duration: ${duration}m | Orders: ${entry.orders || 0}</span>`;
      } else {
        info += `<br><span class="badge badge-processing">Active</span></span>`;
      }
      div.innerHTML = info;
      container.appendChild(div);
    });
  };

  // ==================== SUPPLIER MODAL EVENTS ====================
  window.openEditSupplierModal = (id) => {
    const db = window.dbManager.get();
    const sup = db.suppliers.find(s => s.id === id);
    if (!sup) return;
    document.getElementById("sup-edit-id").value = sup.id;
    document.getElementById("sup-name").value = sup.name;
    document.getElementById("sup-contact").value = sup.contact || "";
    document.getElementById("sup-materials").value = typeof sup.materials === 'string' ? sup.materials : (Array.isArray(sup.materials) ? sup.materials.join(", ") : "");
    document.getElementById("sup-terms").value = sup.terms || sup.paymentTerms || "";
    document.getElementById("modal-edit-supplier").classList.add("active");
  };

  document.getElementById("close-edit-supplier-modal")?.addEventListener("click", () => {
    document.getElementById("modal-edit-supplier").classList.remove("active");
  });

  document.getElementById("edit-supplier-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const db = window.dbManager.get();
    const id = document.getElementById("sup-edit-id").value;
    const sup = db.suppliers.find(s => s.id === id);
    if (!sup) return;
    sup.name = document.getElementById("sup-name").value;
    sup.contact = document.getElementById("sup-contact").value;
    sup.materials = document.getElementById("sup-materials").value;
    sup.terms = document.getElementById("sup-terms").value;
    sup.paymentTerms = sup.terms;
    window.dbManager.save(db);
    document.getElementById("modal-edit-supplier").classList.remove("active");
    renderSuppliers();
    logActivity("Supplier '" + sup.name + "' updated");
  });

  window.deleteSupplier = (id) => {
    if (!confirm('Delete this supplier?')) return;
    const db = window.dbManager.get();
    const sup = db.suppliers.find(s => s.id === id);
    db.suppliers = db.suppliers.filter(s => s.id !== id);
    window.dbManager.save(db);
    renderSuppliers();
    if (sup) logActivity("Supplier '" + sup.name + "' deleted");
  };

  // ==================== RECIPE EDIT HELPER ====================
  window.editRecipeFromRecipes = (id) => {
    if (window.editMenuItem) window.editMenuItem(id);
  };

  window.renderSessionLog = renderSessionLog;

  // Check if already logged in (MUST be after all const function definitions)
  if (window.authSystem.isLoggedIn()) {
    hideAuthScreen();
    initApp();
  } else {
    authScreen.classList.remove('hidden');
    showAuthForm('auth-login-form');
  }
});
