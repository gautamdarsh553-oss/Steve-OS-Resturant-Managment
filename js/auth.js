// Auth module - handles login, registration OTP verification, password reset, and role-based permissions.
// OTP is ONLY used during account registration (sent via email, never exposed to client).
// Login is direct (username + password -> JWT, no OTP step).
// Rate limiting: max 20 login attempts per hour per user.

const ROLES = {
  admin: {
    name: "Administrator",
    description: "Full system control",
    allowedViews: [
      "dashboard", "orders", "inventory", "db-editor", "employees",
      "attendance", "salaries", "analytics", "sales-reports", "profit-reports",
      "notifications", "raw-materials", "recipes",
      "suppliers", "monthly-summary", "settings"
    ]
  },
  manager: {
    name: "Restaurant Manager",
    description: "Operational management and monitoring",
    allowedViews: [
      "dashboard", "orders", "inventory", "employees", "attendance",
      "salaries", "analytics", "sales-reports", "profit-reports",
      "notifications", "raw-materials", "recipes",
      "suppliers", "monthly-summary", "settings"
    ]
  },
  cashier: {
    name: "Cashier",
    description: "Order entry and cashier reports",
    allowedViews: [
      "dashboard", "orders", "attendance", "sales-reports", "notifications", "settings"
    ]
  },
  kitchen: {
    name: "Kitchen Staff",
    description: "Order preparation and recipe viewing",
    allowedViews: [
      "orders", "recipes", "attendance", "notifications"
    ]
  },
  inventory: {
    name: "Inventory Specialist",
    description: "Stock entries and material logs",
    allowedViews: [
      "inventory", "raw-materials", "suppliers", "attendance", "notifications"
    ]
  }
};

const API_BASE = '';

function sanitize(str) {
  return String(str || '').replace(/[<>"']/g, '').trim();
}

class AuthSystem {
  constructor() {
    this.token = localStorage.getItem("steve_auth_token");
    this.currentRoleKey = localStorage.getItem("steve_current_role") || "admin";
    this.currentUser = JSON.parse(localStorage.getItem("steve_auth_user") || "null");
    this.pendingRegistrationEmail = null;
  }

  isLoggedIn() {
    return !!this.token;
  }

  getToken() {
    return this.token;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentRole() {
    return ROLES[this.currentRoleKey] || ROLES.admin;
  }

  getCurrentRoleKey() {
    return this.currentRoleKey;
  }

  setSession(token, role, user) {
    this.token = token;
    this.currentRoleKey = role || 'admin';
    this.currentUser = user;
    localStorage.setItem("steve_auth_token", token);
    localStorage.setItem("steve_current_role", this.currentRoleKey);
    localStorage.setItem("steve_auth_user", JSON.stringify(user));
  }

  clearSession() {
    this.token = null;
    this.currentRoleKey = 'admin';
    this.currentUser = null;
    localStorage.removeItem("steve_auth_token");
    localStorage.removeItem("steve_current_role");
    localStorage.removeItem("steve_auth_user");
  }

  async login(username, password) {
    const cleanUser = sanitize(username);
    if (!cleanUser || !password) {
      return { success: false, error: 'Username and password are required.' };
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          return { success: false, error: data.error, rateLimited: true, remaining: 0 };
        }
        return { success: false, error: data.error || 'Login failed.', remaining: data.remaining };
      }

      // Direct login - JWT returned immediately, no OTP step
      this.setSession(data.token, data.role, data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Could not connect to server. Make sure the backend is running on port 8000.' };
    }
  }

  async verifyRegistrationOtp(otp) {
    if (!this.pendingRegistrationEmail || !otp) {
      return { success: false, error: 'Missing email or OTP.' };
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-registration-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.pendingRegistrationEmail, otp })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'OTP verification failed.' };
      }

      this.setSession(data.token, data.role, data.user);
      this.pendingRegistrationEmail = null;
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Could not connect to server.' };
    }
  }

  async forgotPassword(email) {
    const cleanEmail = sanitize(email).toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Email is required.' };
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Request failed.' };
      }

      return { success: true, maskedEmail: data.maskedEmail, email: cleanEmail };
    } catch (err) {
      return { success: false, error: 'Could not connect to server.' };
    }
  }

  async resetPassword(email, otp, newPassword) {
    const cleanEmail = sanitize(email).toLowerCase();
    if (!cleanEmail || !otp || !newPassword) {
      return { success: false, error: 'All fields are required.' };
    }
    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp, newPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Password reset failed.' };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Could not connect to server.' };
    }
  }

  async register(username, email, password) {
    const cleanUser = sanitize(username);
    const cleanEmail = sanitize(email).toLowerCase();
    if (!cleanUser || !cleanEmail || !password) {
      return { success: false, error: 'All fields are required.' };
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, email: cleanEmail, password })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed.' };
      }

      // OTP sent to email - store pending email for next step
      this.pendingRegistrationEmail = cleanEmail;
      return {
        success: true,
        requiresOtp: true,
        maskedEmail: data.maskedEmail,
        message: data.message
      };
    } catch (err) {
      return { success: false, error: 'Could not connect to server.' };
    }
  }

  logout() {
    this.clearSession();
    // Show auth screen without page reload
    const authScreen = document.getElementById("auth-screen");
    if (authScreen) {
      authScreen.classList.remove("hidden");
      // Reset to login form
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      document.getElementById('auth-login-form').classList.add('active');
      document.querySelectorAll('.auth-error, .auth-success').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
    }
  }

  setRole(roleKey) {
    if (ROLES[roleKey]) {
      this.currentRoleKey = roleKey;
      localStorage.setItem("steve_current_role", roleKey);
      return true;
    }
    return false;
  }

  hasPermission(viewName) {
    const role = this.getCurrentRole();
    return role.allowedViews.includes(viewName);
  }

  getAllRoles() {
    return ROLES;
  }
}

const authSystem = new AuthSystem();
window.authSystem = authSystem;
