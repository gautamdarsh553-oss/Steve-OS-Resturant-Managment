// Express Backend API Server — Steve OS Restaurant Management System
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const stripe = require('stripe');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
// Serve static files (frontend) from project root
app.use(express.static(path.join(__dirname, '..')));
const PORT = process.env.PORT || 5000;

// Enable CORS and parsing middleware
app.use(cors());

// Use Stripe webhook signature verification, which requires raw body parsing
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});

// ==================== DATABASE CONNECTIONS & MOCK SYSTEM ====================
// Uses Supabase client if credentials are configured in .env, otherwise defaults to local filesystem/memory state
let supabase = null;
const isSupabaseConfigured = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log("Supabase client initialized successfully.");
  } catch (err) {
    console.warn("Could not connect to Supabase. Falling back to local memory storage.", err);
  }
} else {
  console.log("Supabase credentials not detected in .env. Operating in Local Mock Mode.");
}

// In-Memory fallback database - starts completely empty (no seed data)
let localDb = {
  menuItems: [],
  rawMaterials: [],
  employees: [],
  suppliers: [],
  orders: [],
  attendance: {},
  salesHistory: [],
  payouts: [],
  users: []
};

// ==================== EMAIL TRANSPORTER (SMTP) ====================
// Used to send OTP codes via real email - NEVER returns OTP to client
let emailTransporter = null;
const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

if (isSmtpConfigured) {
  try {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    console.log("SMTP email transporter initialized successfully.");
  } catch (err) {
    console.warn("Could not initialize SMTP transporter:", err.message);
  }
} else {
  console.log("SMTP credentials not configured. OTP will only be logged to console (not sent via email).");
  console.log("To enable real email sending, set SMTP_HOST, SMTP_USER, and SMTP_PASS in backend/.env");
}

async function sendOTPEmail(toEmail, otpCode, purpose = 'login') {
  if (!emailTransporter) {
    console.log(`[EMAIL NOT SENT - SMTP not configured] OTP for ${toEmail} (${purpose}): ${otpCode}`);
    return false;
  }

  let subject, heading, bodyText;
  if (purpose === 'password-reset') {
    subject = 'Steve OS - Password Reset OTP';
    heading = 'Password Reset Request';
    bodyText = 'You requested a password reset. Use the following OTP to proceed:';
  } else if (purpose === 'registration') {
    subject = 'Steve OS - Verify Your Email';
    heading = 'Account Registration';
    bodyText = 'Welcome! Use the following OTP to verify your email and complete registration:';
  } else {
    subject = 'Steve OS - Verification Code';
    heading = 'Verification Required';
    bodyText = 'Use the following OTP to proceed:';
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9fafb; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px;">✨</span>
        <h1 style="font-size: 20px; color: #1f2937; margin: 8px 0 0;">Steve OS</h1>
        <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0;">Restaurant Resource Management</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="font-size: 16px; color: #374151; margin: 0 0 16px;">${heading}</h2>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">${bodyText}</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; background: #1f2937; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 12px 24px; border-radius: 8px; font-family: monospace;">${otpCode}</span>
        </div>
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.4; margin: 0;">
          This OTP expires in 5 minutes. If you did not request this, please ignore this email.
        </p>
      </div>
      <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 24px;">
        &copy; 2026 Steve OS &mdash; Restaurant Resource Management System
      </p>
    </div>
  `;

  try {
    await emailTransporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Steve OS'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html
    });
    console.log(`OTP email sent successfully to ${toEmail} (${purpose})`);
    return true;
  } catch (err) {
    console.error(`Failed to send OTP email to ${toEmail}:`, err.message);
    console.log(`[FALLBACK] OTP for ${toEmail} (${purpose}): ${otpCode}`);
    return false;
  }
}

// ==================== IN-MEMORY OTP STORE (NEVER SAVED TO DB) ====================
// OTPs are stored only in server memory, never persisted to any database
// Key: username, value: { otp, email, role, expiresAt }
const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==================== RATE LIMITER (IN-MEMORY) ====================

// ==================== RATE LIMITER (IN-MEMORY) ====================
// Tracks login attempts per username - max 20 per rolling hour
const rateLimitStore = new Map(); // key: username, value: { count, windowStart }

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(username) {
  const now = Date.now();
  const entry = rateLimitStore.get(username);
  
  if (!entry || (now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
    // Reset window
    rateLimitStore.set(username, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    const resetIn = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}



// ==================== AUTH MIDDLEWARE ====================
const JWT_SECRET = process.env.JWT_SECRET || 'steve_restaurant_jwt_secure_key';

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: "Access token missing." });

  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid credentials token." });
  }
};

// Admin/Manager permission check
const checkAdminManager = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    next();
  } else {
    return res.status(403).json({ error: "Access denied. Admin or Manager role required." });
  }
};

// ==================== ENDPOINTS: AUTHENTICATION ====================

// POST /api/auth/register - Step 1: Send OTP to email, don't create user yet
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  const sanitized = (str) => str.replace(/[<>"']/g, '').trim();
  const cleanUsername = sanitized(username);
  const cleanEmail = sanitized(email).toLowerCase();
  const cleanRole = sanitized(role || 'cashier');

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }

  try {
    if (supabase) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .or(`username.eq.${cleanUsername},email.eq.${cleanEmail}`)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'Username or email already exists.' });
      }
    } else {
      const exists = localDb.users.find(u => u.username === cleanUsername || u.email === cleanEmail);
      if (exists) {
        return res.status(409).json({ error: 'Username or email already exists.' });
      }
    }

    // Store pending registration in memory with OTP (NEVER in DB, NEVER returned to client)
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore.set(`reg:${cleanEmail}`, {
      otp,
      username: cleanUsername,
      email: cleanEmail,
      password,
      role: cleanRole,
      expiresAt
    });

    // Send OTP via email ONLY
    await sendOTPEmail(cleanEmail, otp, 'registration');

    const maskedEmail = cleanEmail.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 4)) + c);

    res.json({
      message: 'OTP sent to your email for verification.',
      requiresOtp: true,
      maskedEmail,
      email: cleanEmail
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/verify-registration-otp - Step 2: Verify OTP, then create user
app.post('/api/auth/verify-registration-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  const cleanEmail = email.replace(/[<>"']/g, '').trim().toLowerCase();
  const stored = otpStore.get(`reg:${cleanEmail}`);

  if (!stored) {
    return res.status(400).json({ error: 'No OTP requested or OTP expired. Please register again.' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(`reg:${cleanEmail}`);
    return res.status(400).json({ error: 'OTP has expired. Please register again.' });
  }

  if (stored.otp !== otp) {
    return res.status(401).json({ error: 'Invalid OTP code.' });
  }

  // OTP verified - clear from memory immediately
  otpStore.delete(`reg:${cleanEmail}`);

  try {
    const passwordHash = await bcrypt.hash(stored.password, 10);
    const newUser = {
      id: 'u' + (supabase ? Math.floor(Math.random() * 1000) : (localDb.users.length + 1)),
      username: stored.username,
      email: stored.email,
      password_hash: passwordHash,
      role: stored.role,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase.from('users').insert([newUser]).select();
      if (error) return res.status(500).json({ error: error.message });
    } else {
      localDb.users.push(newUser);
    }

    // Return JWT token directly (auto-login after registration)
    const token = jwt.sign(
      { username: stored.username, role: stored.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Account created successfully.',
      token,
      role: stored.role,
      user: { username: stored.username, email: stored.email, role: stored.role }
    });
  } catch (err) {
    console.error('Registration verification error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/login - Direct login (NO OTP). Just verify password and return JWT.
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUsername = username.replace(/[<>"']/g, '').trim().toLowerCase();

  const rateCheck = checkRateLimit(cleanUsername);
  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.resetIn / 60);
    return res.status(429).json({
      error: `Too many login attempts. Try again in ${minutes} minute(s).`,
      remaining: 0,
      resetIn: rateCheck.resetIn
    });
  }

  try {
    let user = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      user = data;
    } else {
      user = localDb.users.find(u => u.username === cleanUsername);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.', remaining: rateCheck.remaining });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.', remaining: rateCheck.remaining });
    }

    // Password correct - return JWT immediately (NO OTP for login)
    const token = jwt.sign(
      { username: cleanUsername, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful.',
      token,
      role: user.role,
      user: { username: cleanUsername, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==================== PASSWORD RESET STORE (IN-MEMORY ONLY) ====================
const pendingResetStore = new Map(); // key: email, value: { username, expiresAt }

// POST /api/auth/forgot-password - Send OTP for password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const cleanEmail = email.replace(/[<>"']/g, '').trim().toLowerCase();

  try {
    let user = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      user = data;
    } else {
      user = localDb.users.find(u => u.email === cleanEmail);
    }

    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    // Generate OTP and store in memory only
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiry

    otpStore.set(`reset:${cleanEmail}`, { otp, email: user.email, username: user.username, expiresAt });

    // Send OTP via email ONLY - never returned to client
    await sendOTPEmail(user.email, otp, 'password-reset');

    // Store pending reset in memory only
    pendingResetStore.set(cleanEmail, {
      username: user.username,
      expiresAt
    });

    // Mask email for display
    const maskedEmail = user.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 4)) + c);

    res.json({
      message: 'OTP sent to your email for password reset.',
      maskedEmail,
      email: cleanEmail
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/reset-password - Verify OTP and set new password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const cleanEmail = email.replace(/[<>"']/g, '').trim().toLowerCase();
  const pending = pendingResetStore.get(cleanEmail);

  if (!pending) {
    return res.status(400).json({ error: 'No OTP requested or OTP expired. Please request a new one.' });
  }

  if (Date.now() > pending.expiresAt) {
    pendingResetStore.delete(cleanEmail);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  // Verify OTP from in-memory store (NEVER from database or client)
  const storedOTP = otpStore.get(`reset:${cleanEmail}`);
  if (!storedOTP || storedOTP.otp !== otp) {
    return res.status(401).json({ error: 'Invalid OTP code.' });
  }

  if (Date.now() > storedOTP.expiresAt) {
    otpStore.delete(`reset:${cleanEmail}`);
    pendingResetStore.delete(cleanEmail);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  // OTP verified - clear from memory immediately
  otpStore.delete(`reset:${cleanEmail}`);
  pendingResetStore.delete(cleanEmail);

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    if (supabase) {
      const { error } = await supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('email', cleanEmail);

      if (error) return res.status(500).json({ error: error.message });
    } else {
      const user = localDb.users.find(u => u.email === cleanEmail);
      if (user) {
        user.password_hash = passwordHash;
      }
    }

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register-default - Creates default admin user if none exist
app.post('/api/auth/register-default', async (req, res) => {
  try {
    let existingUsers = [];

    if (supabase) {
      const { data, error } = await supabase.from('users').select('id').limit(1);
      if (error) return res.status(500).json({ error: error.message });
      existingUsers = data || [];
    } else {
      existingUsers = localDb.users;
    }

    if (existingUsers.length > 0) {
      return res.json({ message: 'Users already exist.', count: existingUsers.length });
    }

    const passwordHash = await bcrypt.hash('admin123', 10);
    const defaultUsers = [
      { id: 'u1', username: 'admin', email: 'admin@restaurant.com', password_hash: passwordHash, role: 'admin' },
      { id: 'u2', username: 'manager', email: 'manager@restaurant.com', password_hash: passwordHash, role: 'manager' },
      { id: 'u3', username: 'cashier', email: 'cashier@restaurant.com', password_hash: passwordHash, role: 'cashier' },
      { id: 'u4', username: 'kitchen', email: 'kitchen@restaurant.com', password_hash: passwordHash, role: 'kitchen' },
      { id: 'u5', username: 'inventory', email: 'inventory@restaurant.com', password_hash: passwordHash, role: 'inventory' }
    ];

    if (supabase) {
      const { error } = await supabase.from('users').insert(defaultUsers);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      localDb.users.push(...defaultUsers);
    }

    res.json({ message: 'Default users created successfully.', users: defaultUsers.map(u => ({ username: u.username, role: u.role, password: 'admin123' })) });
  } catch (err) {
    console.error('Default user creation error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==================== ENDPOINTS: ANALYTICS ====================
app.get('/api/analytics/summary', async (req, res) => {
  let orders = [];
  let menuItems = [];

  if (supabase) {
    const { data: ordersData, error: orderErr } = await supabase.from('orders').select('*');
    if (orderErr) return res.status(500).json({ error: orderErr.message });
    orders = ordersData;

    const { data: menuData, error: menuErr } = await supabase.from('menu_items').select('*');
    if (menuErr) return res.status(500).json({ error: menuErr.message });
    menuItems = menuData;
  } else {
    orders = localDb.orders;
    menuItems = localDb.menuItems;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const filteredOrders = orders.filter(o => o.status !== 'refunded');
  const todayOrders = filteredOrders.filter(o => o.date === todayStr);

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const orderCount = filteredOrders.length;
  const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const todayOrderCount = todayOrders.length;

  let totalProfit = 0;
  filteredOrders.forEach(order => {
    const items = order.items || [];
    items.forEach(it => {
      const menuItem = menuItems.find(m => m.id === it.itemId);
      if (menuItem) {
        totalProfit += (menuItem.profit || 0) * it.quantity;
      }
    });
  });

  let todayProfit = 0;
  todayOrders.forEach(order => {
    const items = order.items || [];
    items.forEach(it => {
      const menuItem = menuItems.find(m => m.id === it.itemId);
      if (menuItem) {
        todayProfit += (menuItem.profit || 0) * it.quantity;
      }
    });
  });

  res.json({
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    orderCount,
    todayRevenue: parseFloat(todayRevenue.toFixed(2)),
    todayProfit: parseFloat(todayProfit.toFixed(2)),
    todayOrderCount
  });
});

app.get('/api/analytics/trends', async (req, res) => {
  let orders = [];
  let menuItems = [];

  if (supabase) {
    const { data: ordersData, error: orderErr } = await supabase.from('orders').select('*');
    if (orderErr) return res.status(500).json({ error: orderErr.message });
    orders = ordersData;

    const { data: menuData, error: menuErr } = await supabase.from('menu_items').select('*');
    if (menuErr) return res.status(500).json({ error: menuErr.message });
    menuItems = menuData;
  } else {
    orders = localDb.orders;
    menuItems = localDb.menuItems;
  }

  const trends = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    trends[dateStr] = { revenue: 0, profit: 0 };
  }

  orders.filter(o => o.status !== 'refunded').forEach(order => {
    const dateStr = order.date;
    if (trends[dateStr]) {
      trends[dateStr].revenue += parseFloat(order.total || 0);
      const items = order.items || [];
      items.forEach(it => {
        const menuItem = menuItems.find(m => m.id === it.itemId);
        if (menuItem) {
          trends[dateStr].profit += (menuItem.profit || 0) * it.quantity;
        }
      });
    }
  });

  const formattedTrends = Object.keys(trends).map(date => ({
    date,
    revenue: parseFloat(trends[date].revenue.toFixed(2)),
    profit: parseFloat(trends[date].profit.toFixed(2))
  }));

  res.json(formattedTrends);
});


// ==================== ENDPOINTS: MENU DATABASE ====================
app.get('/api/menu', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('menu_items').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  res.json(localDb.menuItems);
});

app.post('/api/menu', verifyToken, checkAdminManager, async (req, res) => {
  const newItem = {
    id: "m" + (supabase ? Math.floor(Math.random()*1000) : (localDb.menuItems.length + 1)),
    ...req.body
  };
  
  if (supabase) {
    const { data, error } = await supabase.from('menu_items').insert([newItem]).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  localDb.menuItems.push(newItem);
  res.json(newItem);
});

app.delete('/api/menu/:id', verifyToken, checkAdminManager, async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }
  localDb.menuItems = localDb.menuItems.filter(m => m.id !== id);
  res.json({ success: true });
});

// ==================== ENDPOINTS: INVENTORY ====================
app.get('/api/inventory', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('raw_materials').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  res.json(localDb.rawMaterials);
});

app.get('/api/inventory/alerts', async (req, res) => {
  let rawMaterials = [];
  let orders = [];
  let menuItems = [];

  if (supabase) {
    const { data: matData, error: matErr } = await supabase.from('raw_materials').select('*');
    if (matErr) return res.status(500).json({ error: matErr.message });
    rawMaterials = matData;

    const { data: ordData, error: ordErr } = await supabase.from('orders').select('*');
    if (ordErr) return res.status(500).json({ error: ordErr.message });
    orders = ordData;

    const { data: menuData, error: menuErr } = await supabase.from('menu_items').select('*');
    if (menuErr) return res.status(500).json({ error: menuErr.message });
    menuItems = menuData;
  } else {
    rawMaterials = localDb.rawMaterials;
    orders = localDb.orders;
    menuItems = localDb.menuItems;
  }

  const alerts = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];

  // Calculate actual usage for the last 7 days to power "AI Prediction"
  const usageMap = {};
  orders.filter(o => o.date >= sevenDaysAgo && o.status !== 'refunded').forEach(order => {
    (order.items || []).forEach(it => {
      const menuItem = menuItems.find(m => m.id === it.itemId);
      if (menuItem && menuItem.recipe) {
        menuItem.recipe.forEach(req => {
          usageMap[req.materialId] = (usageMap[req.materialId] || 0) + (req.quantity * it.quantity);
        });
      }
    });
  });

  rawMaterials.forEach(mat => {
    const dailyUsage = (usageMap[mat.id] || 0) / 7;
    const daysLeft = dailyUsage > 0 ? mat.quantity / dailyUsage : 999;

    if (mat.quantity <= mat.minStock) {
      alerts.push({
        id: mat.id,
        type: 'critical',
        message: `${mat.name} is critically low (${mat.quantity} ${mat.unit} left). Re-stock immediately.`,
        daysLeft: daysLeft.toFixed(1)
      });
    } else if (daysLeft < 3) {
      alerts.push({
        id: mat.id,
        type: 'warning',
        message: `AI Prediction: ${mat.name} stock may run out in ${daysLeft.toFixed(1)} days based on recent trends.`,
        daysLeft: daysLeft.toFixed(1)
      });
    }
  });

  res.json(alerts);
});

app.post('/api/inventory/setup', verifyToken, async (req, res) => {
  const { stockValues } = req.body;
  if (supabase) {
    for (const [id, val] of Object.entries(stockValues)) {
      await supabase.from('raw_materials').update({ quantity: parseFloat(val) }).eq('id', id);
    }
    return res.json({ success: true });
  }
  
  localDb.rawMaterials.forEach(m => {
    if (stockValues[m.id] !== undefined) {
      m.quantity = parseFloat(stockValues[m.id]);
    }
  });
  res.json({ success: true });
});

// ==================== ENDPOINTS: ORDERS ====================
app.get('/api/orders', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').order('time', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  res.json(localDb.orders);
});

app.post('/api/orders', async (req, res) => {
  const { table, items, total, order_source, payment_method, employee_name, notes } = req.body;
  const now = new Date();
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  const date = now.toISOString().split('T')[0];
  const orderId = "o" + (supabase ? Math.floor(Math.random()*10000) : (localDb.orders.length + 1001));

  const newOrder = {
    id: orderId,
    table_label: table || 'Takeaway',
    items,
    total: parseFloat(total),
    status: 'pending',
    time,
    date,
    order_source: order_source || 'POS',
    payment_method: payment_method || 'Cash',
    employee_name: employee_name || 'Cashier',
    notes: notes || ''
  };

  // Perform ingredient auto-deduction and stock check
  const menuList = supabase
    ? (await supabase.from('menu_items').select('*')).data
    : localDb.menuItems;

  const materialsList = supabase
    ? (await supabase.from('raw_materials').select('*')).data
    : localDb.rawMaterials;

  const deductions = [];
  let insufficientStock = false;
  let missingItem = '';

  items.forEach(it => {
    const menuItem = menuList.find(m => m.id === it.itemId);
    if (menuItem && menuItem.recipe) {
      menuItem.recipe.forEach(req => {
        const material = materialsList.find(m => m.id === req.materialId);
        if (material) {
          const qtyUsed = req.quantity * it.quantity;
          if (material.quantity < qtyUsed) {
            insufficientStock = true;
            missingItem = material.name;
          }
          deductions.push({
            id: material.id,
            newQuantity: Math.max(0, parseFloat((material.quantity - qtyUsed).toFixed(3)))
          });
        }
      });
    }
  });

  if (insufficientStock) {
    return res.status(400).json({ error: `Insufficient stock for ${missingItem}. Order cannot be placed.` });
  }

  // Save only changed materials updates
  if (supabase) {
    for (const update of deductions) {
      await supabase.from('raw_materials').update({ quantity: update.newQuantity }).eq('id', update.id);
    }
    const { data, error } = await supabase.from('orders').insert([newOrder]).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  } else {
    deductions.forEach(update => {
      const mat = localDb.rawMaterials.find(m => m.id === update.id);
      if (mat) mat.quantity = update.newQuantity;
    });
    localDb.orders.push(newOrder);
    res.json(newOrder);
  }
});

// Update order status or process edit overrides
app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body; // can contain { status } or { items, total }

  if (supabase) {
    const { data: orderData, error: orderErr } = await supabase.from('orders').select('*').eq('id', id).single();
    if (orderErr) return res.status(400).json({ error: orderErr.message });
    const order = orderData;

    // Inventory Reversal if status is being changed to 'refunded'
    if (updates.status === 'refunded' && order.status !== 'refunded') {
      const items = order.items || [];
      const menuList = (await supabase.from('menu_items').select('*')).data;
      for (const it of items) {
        const menuItem = menuList.find(m => m.id === it.itemId);
        if (menuItem && menuItem.recipe) {
          for (const req of menuItem.recipe) {
            const { data: mat } = await supabase.from('raw_materials').select('quantity').eq('id', req.materialId).single();
            if (mat) {
              const qtyToAdd = req.quantity * it.quantity;
              await supabase.from('raw_materials').update({ quantity: mat.quantity + qtyToAdd }).eq('id', req.materialId);
            }
          }
        }
      }
    }

    const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }

  const order = localDb.orders.find(o => o.id === id);
  if (order) {
    // Inventory Reversal in Local Mock Mode
    if (updates.status === 'refunded' && order.status !== 'refunded') {
      const items = order.items || [];
      items.forEach(it => {
        const menuItem = localDb.menuItems.find(m => m.id === it.itemId);
        if (menuItem && menuItem.recipe) { // Fixed typo: menuItemC -> menuItem
          menuItem.recipe.forEach(req => {
            const material = localDb.rawMaterials.find(m => m.id === req.materialId);
            if (material) {
              material.quantity += req.quantity * it.quantity;
            }
          });
        }
      });
    }
    Object.assign(order, updates);
    res.json(order);
  } else {
    res.status(404).json({ error: "Order not found." });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    const { data: orderData, error: orderErr } = await supabase.from('orders').select('*').eq('id', id).single();
    if (orderErr) return res.status(404).json({ error: "Order not found." });
    const order = orderData;

    // Reverse inventory deduction
    const items = order.items || [];
    const menuList = (await supabase.from('menu_items').select('*')).data;
    for (const it of items) {
      const menuItem = menuList.find(m => m.id === it.itemId);
      if (menuItem && menuItem.recipe) {
        for (const req of menuItem.recipe) {
          const { data: mat } = await supabase.from('raw_materials').select('quantity').eq('id', req.materialId).single();
          if (mat) {
            const qtyToAdd = req.quantity * it.quantity;
            await supabase.from('raw_materials').update({ quantity: mat.quantity + qtyToAdd }).eq('id', req.materialId);
          }
        }
      }
    }

    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  const orderIndex = localDb.orders.findIndex(o => o.id === id);
  if (orderIndex > -1) {
    const order = localDb.orders[orderIndex];
    // Reverse inventory deduction in Local Mock Mode
    const items = order.items || [];
    items.forEach(it => {
      const menuItem = localDb.menuItems.find(m => m.id === it.itemId);
      if (menuItem && menuItem.recipe) {
        menuItem.recipe.forEach(req => {
          const material = localDb.rawMaterials.find(m => m.id === req.materialId);
          if (material) {
            material.quantity += req.quantity * it.quantity;
          }
        });
      }
    });
    localDb.orders.splice(orderIndex, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Order not found." });
  }
});

// ==================== ENDPOINTS: EMPLOYEES & ATTENDANCE ====================
app.get('/api/employees', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('employees').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  res.json(localDb.employees);
});

app.post('/api/employees', verifyToken, checkAdminManager, async (req, res) => {
  const newEmp = {
    id: "e" + (supabase ? Math.floor(Math.random()*100) : (localDb.employees.length + 1)),
    rating: 5.0,
    performance: "New Joiner",
    orders_completed: 0,
    overtime_hours: 0.0,
    payment_status: "Unpaid",
    last_payment_date: "—",
    ...req.body
  };

  if (supabase) {
    const { data, error } = await supabase.from('employees').insert([newEmp]).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  localDb.employees.push(newEmp);
  res.json(newEmp);
});

app.put('/api/employees/:id', verifyToken, checkAdminManager, async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const { data, error } = await supabase.from('employees').update(req.body).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  const emp = localDb.employees.find(e => e.id === id);
  if (emp) {
    Object.assign(emp, req.body);
    res.json(emp);
  } else {
    res.status(404).json({ error: "Employee not found." });
  }
});

app.delete('/api/employees/:id', verifyToken, checkAdminManager, async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }
  localDb.employees = localDb.employees.filter(e => e.id !== id);
  res.json({ success: true });
});

app.get('/api/attendance', async (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  if (supabase) {
    const { data, error } = await supabase.from('attendance').select('*').eq('date', todayStr);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  const todayRecords = localDb.attendance.filter(a => a.date === todayStr);
  res.json(todayRecords);
});

app.post('/api/attendance/clockin', async (req, res) => {
  const { employeeId, status: requestedStatus } = req.body;
  const allowedStatuses = ['present', 'absent', 'late'];
  const status = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'present';

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = now.toISOString().split('T')[0];

  const newLog = {
    id: supabase ? undefined : ("att" + Math.floor(Math.random()*10000)),
    date,
    employee_id: employeeId,
    status,                               // now supports: present | absent | late
    time_in: status === 'present' || status === 'late' ? time : null,
    time_out: null
  };

  if (supabase) {
    const { data, error } = await supabase.from('attendance').insert([newLog]).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  localDb.attendance.push(newLog);
  res.json(newLog);
});

app.post('/api/attendance/clockout', async (req, res) => {
  const { employeeId } = req.body;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = now.toISOString().split('T')[0];

  if (supabase) {
    const { data, error } = await supabase.from('attendance')
      .update({ time_out: time })
      .eq('date', date)
      .eq('employee_id', employeeId)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }

  const log = localDb.attendance.find(a => a.date === date && a.employee_id === employeeId);
  if (log) {
    log.time_out = time;
    res.json(log);
  } else {
    res.status(404).json({ error: "Attendance clock-in log not found." });
  }
});

// ==================== ENDPOINTS: STRIPE SALARY INTEGRATION ====================
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeClient = stripeSecret ? stripe(stripeSecret) : null;

const isStripeReal = stripeSecret && !stripeSecret.startsWith('sk_test_mock') && stripeSecret.includes('_');

app.post('/api/stripe/create-checkout-session', verifyToken, checkAdminManager, async (req, res) => {
  const { employeeId, salaryAmount } = req.body;
  const dbEmployees = supabase 
    ? (await supabase.from('employees').select('*')).data
    : localDb.employees;
    
  const emp = dbEmployees.find(e => e.id === employeeId);
  if (!emp) return res.status(404).json({ error: "Employee profile file not found." });

  const domain = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    if (!isStripeReal) {
      return res.status(400).json({
        error: "Stripe is not configured. Set a valid STRIPE_SECRET_KEY in backend/.env to enable real payments. Get your key at https://dashboard.stripe.com/apikeys"
      });
    }

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Salary Payout to ${emp.name}`,
            description: `Role: ${emp.role} - ${new Date().toLocaleString('default', { month: 'long' })} Payroll`,
          },
          unit_amount: Math.round(parseFloat(salaryAmount) * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${domain}/?session_id={CHECKOUT_SESSION_ID}&employee_id=${employeeId}&amount=${salaryAmount}`,
      cancel_url: `${domain}/?cancel=true`,
      metadata: {
        employeeId,
        salaryAmount: salaryAmount.toString()
      }
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("Stripe Checkout creation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Verify payment after Stripe Checkout redirect (works with real Stripe or local mode)
app.post('/api/stripe/verify-payment', verifyToken, checkAdminManager, async (req, res) => {
  const { employeeId, amount, sessionId } = req.body;
  const todayStr = new Date().toISOString().split('T')[0];

  if (isStripeReal && sessionId) {
    try {
      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed." });
      }
    } catch (err) {
      return res.status(500).json({ error: "Failed to verify Stripe session." });
    }
  }

  const payout = {
    id: "pay_" + Math.random().toString(36).substring(2, 10),
    employee_id: employeeId,
    amount: parseFloat(amount),
    status: 'paid',
    stripe_charge_id: sessionId,
    date: todayStr
  };

  if (supabase) {
    await supabase.from('employees').update({ payment_status: 'Paid', last_payment_date: todayStr }).eq('id', employeeId);
    await supabase.from('salaries_payouts').insert([payout]);
  } else {
    const emp = localDb.employees.find(e => e.id === employeeId);
    if (emp) {
      emp.payment_status = "Paid";
      emp.last_payment_date = todayStr;
    }
    localDb.payouts.push(payout);
  }

  res.json({ success: true, payout });
});

// Stripe Webhook Endpoint (Production webhook - only works with real Stripe key)
app.post('/api/stripe/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  if (!isStripeReal || !stripeClient) {
    return res.status(200).json({ received: true, note: "Webhooks require a real STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env" });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const employeeId = session.metadata.employeeId;
    const amount = parseFloat(session.metadata.salaryAmount);
    const chargeId = session.payment_intent;
    const todayStr = new Date().toISOString().split('T')[0];

    const payout = {
      employee_id: employeeId,
      amount,
      status: 'paid',
      stripe_charge_id: chargeId,
      date: todayStr
    };

    if (supabase) {
      await supabase.from('employees').update({ payment_status: 'Paid', last_payment_date: todayStr }).eq('id', employeeId);
      await supabase.from('salaries_payouts').insert([payout]);
    } else {
      const emp = localDb.employees.find(e => e.id === employeeId);
      if (emp) {
        emp.payment_status = "Paid";
        emp.last_payment_date = todayStr;
      }
      localDb.payouts.push(payout);
    }
    console.log(`Payment confirmed for employee ${employeeId} ($${amount}) via Stripe Checkout.`);
  }

  res.json({ received: true });
});

// Auto-seed default users on startup
async function seedDefaultUsers() {
  try {
    let existingUsers = [];

    if (supabase) {
      const { data, error } = await supabase.from('users').select('id').limit(1);
      if (error) {
        console.log('Users table may not exist yet. Run schema.sql in Supabase SQL Editor first.');
        return;
      }
      existingUsers = data || [];
    } else {
      existingUsers = localDb.users;
    }

    if (existingUsers.length > 0) {
      console.log(`Found ${existingUsers.length} existing user(s). Skipping seed.`);
      return;
    }

    const passwordHash = await bcrypt.hash('admin123', 10);
    const defaultUsers = [
      { id: 'u1', username: 'admin', email: 'admin@restaurant.com', password_hash: passwordHash, role: 'admin' },
      { id: 'u2', username: 'manager', email: 'manager@restaurant.com', password_hash: passwordHash, role: 'manager' },
      { id: 'u3', username: 'cashier', email: 'cashier@restaurant.com', password_hash: passwordHash, role: 'cashier' },
      { id: 'u4', username: 'kitchen', email: 'kitchen@restaurant.com', password_hash: passwordHash, role: 'kitchen' },
      { id: 'u5', username: 'inventory', email: 'inventory@restaurant.com', password_hash: passwordHash, role: 'inventory' }
    ];

    if (supabase) {
      const { error } = await supabase.from('users').insert(defaultUsers);
      if (error) {
        console.error('Failed to seed users:', error.message);
        return;
      }
    } else {
      localDb.users.push(...defaultUsers);
    }

    console.log('Default users created successfully.');
    console.log('  admin     -> admin@restaurant.com   (role: admin)');
    console.log('  manager   -> manager@restaurant.com (role: manager)');
    console.log('  cashier   -> cashier@restaurant.com (role: cashier)');
    console.log('  kitchen   -> kitchen@restaurant.com (role: kitchen)');
    console.log('  inventory -> inventory@restaurant.com (role: inventory)');
    console.log('  All passwords: admin123');
  } catch (err) {
    console.log('Could not auto-seed users:', err.message);
  }
}

async function seedDefaultData() {
  try {
    if (localDb.menuItems.length > 0) {
      console.log(`Found ${localDb.menuItems.length} menu items. Skipping data seed.`);
      return;
    }

    const defaultRawMaterials = [
      { id: 'rm1', name: 'Chicken Patty', type: 'Frozen', unit: 'pcs', quantity: 50, minStock: 10, costPerUnit: 1.50 },
      { id: 'rm2', name: 'Burger Bun', type: 'Bakery', unit: 'pcs', quantity: 60, minStock: 15, costPerUnit: 0.40 },
      { id: 'rm3', name: 'Cheese Slice', type: 'Dairy', unit: 'pcs', quantity: 80, minStock: 20, costPerUnit: 0.30 },
      { id: 'rm4', name: 'Lettuce', type: 'Produce', unit: 'pcs', quantity: 30, minStock: 8, costPerUnit: 0.25 },
      { id: 'rm5', name: 'Tomato', type: 'Produce', unit: 'pcs', quantity: 40, minStock: 10, costPerUnit: 0.20 },
      { id: 'rm6', name: 'Pizza Dough', type: 'Bakery', unit: 'pcs', quantity: 30, minStock: 8, costPerUnit: 1.00 },
      { id: 'rm7', name: 'Pizza Sauce', type: 'Canned', unit: 'cups', quantity: 25, minStock: 5, costPerUnit: 0.75 },
      { id: 'rm8', name: 'Mozzarella', type: 'Dairy', unit: 'cups', quantity: 40, minStock: 10, costPerUnit: 0.90 },
      { id: 'rm9', name: 'Pepperoni', type: 'Frozen', unit: 'pcs', quantity: 60, minStock: 15, costPerUnit: 0.60 },
      { id: 'rm10', name: 'French Fries', type: 'Frozen', unit: 'cups', quantity: 50, minStock: 10, costPerUnit: 0.50 },
      { id: 'rm11', name: 'Chicken Wings', type: 'Frozen', unit: 'pcs', quantity: 80, minStock: 20, costPerUnit: 0.80 },
      { id: 'rm12', name: 'Soda Syrup', type: 'Beverage', unit: 'liters', quantity: 15, minStock: 3, costPerUnit: 2.00 },
      { id: 'rm13', name: 'Flour Tortilla', type: 'Bakery', unit: 'pcs', quantity: 40, minStock: 10, costPerUnit: 0.35 },
      { id: 'rm14', name: 'Ground Beef', type: 'Meat', unit: 'lbs', quantity: 30, minStock: 8, costPerUnit: 2.50 },
      { id: 'rm15', name: 'BBQ Sauce', type: 'Condiment', unit: 'cups', quantity: 20, minStock: 5, costPerUnit: 0.60 },
      { id: 'rm16', name: 'Onion', type: 'Produce', unit: 'pcs', quantity: 35, minStock: 10, costPerUnit: 0.15 },
      { id: 'rm17', name: 'Pickles', type: 'Condiment', unit: 'pcs', quantity: 50, minStock: 10, costPerUnit: 0.10 },
      { id: 'rm18', name: 'Ice Cream Scoop', type: 'Dairy', unit: 'pcs', quantity: 40, minStock: 10, costPerUnit: 0.70 },
      { id: 'rm19', name: 'Brownie', type: 'Bakery', unit: 'pcs', quantity: 30, minStock: 8, costPerUnit: 0.80 },
      { id: 'rm20', name: 'Coffee Beans', type: 'Beverage', unit: 'cups', quantity: 25, minStock: 5, costPerUnit: 0.50 }
    ];

    const defaultMenuItems = [
      { id: 'm1', name: 'Classic Burger', category: 'Burgers', sellingPrice: 8.99, prepTime: 8, icon: '🍔', instructions: 'Grill patty, toast bun, assemble with lettuce, tomato, cheese, and sauce.', recipe: [{ materialId: 'rm1', quantity: 1 }, { materialId: 'rm2', quantity: 1 }, { materialId: 'rm3', quantity: 1 }, { materialId: 'rm4', quantity: 2 }, { materialId: 'rm5', quantity: 2 }], profit: 5.20 },
      { id: 'm2', name: 'Cheese Burger', category: 'Burgers', sellingPrice: 9.99, prepTime: 8, icon: '🧀', instructions: 'Classic burger with double cheese slices.', recipe: [{ materialId: 'rm1', quantity: 1 }, { materialId: 'rm2', quantity: 1 }, { materialId: 'rm3', quantity: 2 }, { materialId: 'rm4', quantity: 2 }, { materialId: 'rm5', quantity: 2 }], profit: 5.70 },
      { id: 'm3', name: 'BBQ Bacon Burger', category: 'Burgers', sellingPrice: 11.99, prepTime: 10, icon: '🥓', instructions: 'Beef patty with bacon, BBQ sauce, onion rings, and cheddar.', recipe: [{ materialId: 'rm14', quantity: 1 }, { materialId: 'rm2', quantity: 1 }, { materialId: 'rm3', quantity: 1 }, { materialId: 'rm15', quantity: 1 }, { materialId: 'rm16', quantity: 1 }], profit: 6.80 },
      { id: 'm4', name: 'Margherita Pizza', category: 'Pizzas', sellingPrice: 12.99, prepTime: 15, icon: '🍕', instructions: 'Stretch dough, spread sauce, add mozzarella, bake until golden.', recipe: [{ materialId: 'rm6', quantity: 1 }, { materialId: 'rm7', quantity: 1 }, { materialId: 'rm8', quantity: 2 }], profit: 7.80 },
      { id: 'm5', name: 'Pepperoni Pizza', category: 'Pizzas', sellingPrice: 14.99, prepTime: 15, icon: '🍕', instructions: 'Margherita with pepperoni slices on top.', recipe: [{ materialId: 'rm6', quantity: 1 }, { materialId: 'rm7', quantity: 1 }, { materialId: 'rm8', quantity: 2 }, { materialId: 'rm9', quantity: 8 }], profit: 8.50 },
      { id: 'm6', name: 'French Fries', category: 'Sides', sellingPrice: 3.99, prepTime: 5, icon: '🍟', instructions: 'Deep fry until golden, season with salt.', recipe: [{ materialId: 'rm10', quantity: 1 }], profit: 2.50 },
      { id: 'm7', name: 'Chicken Wings (6 pcs)', category: 'Sides', sellingPrice: 7.99, prepTime: 10, icon: '🍗', instructions: 'Fry wings, toss in BBQ sauce, serve with ranch.', recipe: [{ materialId: 'rm11', quantity: 6 }, { materialId: 'rm15', quantity: 1 }], profit: 4.20 },
      { id: 'm8', name: 'Soft Drink', category: 'Drinks', sellingPrice: 1.99, prepTime: 1, icon: '🥤', instructions: 'Pour soda from dispenser with ice.', recipe: [{ materialId: 'rm12', quantity: 0.3 }], profit: 1.40 },
      { id: 'm9', name: 'Chicken Wrap', category: 'Sandwiches', sellingPrice: 8.49, prepTime: 8, icon: '🌯', instructions: 'Grill chicken, wrap in tortilla with lettuce, tomato, and sauce.', recipe: [{ materialId: 'rm1', quantity: 1 }, { materialId: 'rm13', quantity: 1 }, { materialId: 'rm4', quantity: 2 }, { materialId: 'rm5', quantity: 2 }], profit: 4.80 },
      { id: 'm10', name: 'Brownie Sundae', category: 'Desserts', sellingPrice: 5.99, prepTime: 3, icon: '🍨', instructions: 'Warm brownie, top with ice cream scoop and chocolate syrup.', recipe: [{ materialId: 'rm18', quantity: 1 }, { materialId: 'rm19', quantity: 1 }], profit: 3.50 },
      { id: 'm11', name: 'Coffee', category: 'Drinks', sellingPrice: 2.99, prepTime: 2, icon: '☕', instructions: 'Brew fresh coffee and serve hot.', recipe: [{ materialId: 'rm20', quantity: 1 }], profit: 2.00 }
    ];

    localDb.rawMaterials = defaultRawMaterials;
    localDb.menuItems = defaultMenuItems;
    localDb.employees = [];
    localDb.suppliers = [];

    console.log('Default restaurant data seeded successfully.');
    console.log(`  ${defaultMenuItems.length} menu items`);
    console.log(`  ${defaultRawMaterials.length} raw materials`);
  } catch (err) {
    console.log('Could not auto-seed data:', err.message);
  }
}

// POST /api/assistant/process — Groq AI directly reads & manipulates database
app.post('/api/assistant/process', async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Text is required.' });
  }

  const apiKeys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  if (apiKeys.length === 0) {
    return res.status(500).json({ success: false, error: 'GROQ_API_KEY not configured.' });
  }

  const today = new Date().toISOString().split('T')[0];
  const db = localDb;

  const dataContext = JSON.stringify({
    menuItems: db.menuItems.map(i => ({ id: i.id, name: i.name, category: i.category, sellingPrice: i.sellingPrice, profit: i.profit, recipe: i.recipe })),
    rawMaterials: db.rawMaterials.map(m => ({ id: m.id, name: m.name, type: m.type, unit: m.unit, quantity: m.quantity, minStock: m.minStock, costPerUnit: m.costPerUnit })),
    employees: db.employees.map(e => ({ id: e.id, name: e.name, role: e.role, hourlyRate: e.hourlyRate, shift: e.shift, rating: e.rating })),
    orders: db.orders.map(o => ({ id: o.id, table: o.table, items: o.items, total: o.total, status: o.status, time: o.time, date: o.date })),
    attendance: (db.attendance || {})[today] || [],
    salesHistory: db.salesHistory || []
  }, null, 2);

  const systemPrompt = `You are Steve, an AI assistant for a restaurant management system called "Steve OS". You have FULL ACCESS to the database. Your job is to read and manipulate data.

Below is the CURRENT DATABASE STATE (JSON). Analyze the user's request, then return an "operations" array of actions to perform on the database, plus a "response" string to say to the user.

AVAILABLE OPERATIONS (you can return multiple):

1. CREATE_ORDER: { "type": "create_order", "data": { "itemId": string, "name": string, "quantity": number, "price": number, "table": string, "items": array } }
   - Matches item name from menuItems array using fuzzy matching
   - Calculates total automatically

2. MARK_ATTENDANCE: { "type": "mark_attendance", "data": { "employeeName": string (or "all"), "status": "present"|"absent"|"late" } }

3. UPDATE_STOCK: { "type": "update_stock", "data": { "materialId": string, "quantity": number (new value) } }

4. QUERY: { "type": "query", "data": { "entity": "menuItems"|"rawMaterials"|"employees"|"orders"|"attendance", "filter": object|null } }
   - Returns matching data to include in response

5. SALES_SUMMARY: { "type": "sales_summary", "data": { "period": "today"|"all" } }

6. NAVIGATE: { "type": "navigate", "data": { "view": "dashboard"|"orders"|"inventory"|"db-editor"|"employees"|"attendance"|"salaries"|"analytics"|"settings" } }

7. RESPOND: { "type": "respond", "data": { "message": string } }

RULES:
- Use fuzzy matching for menu item names and employee names
- For queries, include the relevant data in your response
- You can combine multiple operations (e.g., create_order + query)
- Be helpful and conversational
- If you don't understand, use respond type with a friendly message

CRITICAL: The "response" field MUST contain ONLY plain natural language text. NO JSON, NO code blocks, NO markdown in the response field. Just a friendly sentence.

DATABASE STATE:
\`\`\`json
${dataContext}
\`\`\`

Return ONLY valid JSON. NEVER include markdown, code fences, or any text outside the JSON structure. The response field must be a plain friendly sentence.`;

  let lastError = '';
  for (const apiKey of apiKeys) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0.1,
          max_tokens: 2000
        })
      });

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        lastError = data.error?.message || data.error || 'Could not process.';
        console.error('Groq error with key:', lastError);
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
      } catch {
        return res.json({ success: true, operations: [{ type: 'respond', data: { message: content } }], response: content });
      }

      const operations = parsed.operations || [];
      const responseMsg = parsed.response || 'Done.';
      let resultData = {};
      let needsRefresh = false;

      for (const op of operations) {
        switch (op.type) {
          case 'create_order': {
            const d = op.data;
            const rawItems = d.items || [];
            if (!rawItems.length && (d.name || d.itemId)) {
              const mi = db.menuItems.find(i =>
                i.name.toLowerCase().includes((d.name || '').toLowerCase()) ||
                (d.itemId && i.id === d.itemId)
              );
              if (mi) rawItems.push({ itemId: mi.id, name: mi.name, quantity: d.quantity || 1 });
            }
            if (!rawItems.length) break;

            const items = rawItems.map(it => {
              const itemId = it.itemId || it.id;
              const mi = db.menuItems.find(m => m.id === itemId || m.name.toLowerCase().includes((it.name || '').toLowerCase()));
              return {
                itemId: mi ? mi.id : itemId,
                name: mi ? mi.name : (it.name || 'Item'),
                quantity: it.quantity || 1,
                price: mi ? mi.sellingPrice : (it.price || 0)
              };
            });

            const total = items.reduce((s, it) => s + (it.price * it.quantity), 0);
            let tableLabel = (d.table || '1').replace(/^Table\s*/i, '');
            const order = {
              id: 'ORD' + Date.now(),
              table: 'Table ' + tableLabel,
              items,
              total: parseFloat(total.toFixed(2)),
              status: 'pending',
              time: new Date().toLocaleTimeString(),
              date: today
            };
            db.orders.push(order);

            const updatedMaterials = [];
            let lowStockWarnings = [];
            items.forEach(it => {
              const mi = db.menuItems.find(m => m.id === it.itemId);
              if (!mi || !mi.recipe) return;
              mi.recipe.forEach(req => {
                const mat = db.rawMaterials.find(m => m.id === req.materialId);
                if (!mat) return;
                const needed = req.quantity * it.quantity;
                if (mat.quantity < needed) {
                  lowStockWarnings.push(`${mi.name}: ${mat.name} low (${mat.quantity} ${mat.unit}, need ${needed})`);
                }
                mat.quantity = Math.max(0, parseFloat((mat.quantity - needed).toFixed(3)));
                if (!updatedMaterials.find(u => u.id === mat.id)) {
                  updatedMaterials.push({ id: mat.id, name: mat.name, quantity: mat.quantity, unit: mat.unit });
                }
              });
            });

            if (!db.salesHistory) db.salesHistory = [];
            const todayEntry = db.salesHistory.find(s => s.date === today);
            const cost = items.reduce((s, it) => {
              const mi = db.menuItems.find(m => m.id === it.itemId);
              return s + (mi ? (mi.sellingPrice - mi.profit) * it.quantity : 0);
            }, 0);
            if (todayEntry) {
              todayEntry.orders = (todayEntry.orders || 0) + 1;
              todayEntry.revenue = parseFloat(((todayEntry.revenue || 0) + order.total).toFixed(2));
              todayEntry.cost = parseFloat(((todayEntry.cost || 0) + cost).toFixed(2));
              todayEntry.profit = parseFloat(((todayEntry.profit || 0) + (order.total - cost)).toFixed(2));
            } else {
              db.salesHistory.push({
                date: today,
                orders: 1,
                revenue: parseFloat(order.total.toFixed(2)),
                cost: parseFloat(cost.toFixed(2)),
                profit: parseFloat((order.total - cost).toFixed(2))
              });
            }

            resultData.orderCreated = true;
            resultData.orders = [order];
            resultData.rawMaterials = updatedMaterials;
            resultData.salesHistory = db.salesHistory;
            if (lowStockWarnings.length) {
              resultData.lowStockWarnings = lowStockWarnings;
            }
            needsRefresh = true;
            break;
          }

          case 'mark_attendance': {
            const d = op.data;
            if (!db.attendance) db.attendance = {};
            if (!db.attendance[today]) db.attendance[today] = [];
            const attToday = db.attendance[today];

            if (d.employeeName === 'all') {
              db.employees.forEach(emp => {
                const existing = attToday.find(a => a.employeeId === emp.id);
                if (existing) existing.status = d.status;
                else attToday.push({ employeeId: emp.id, name: emp.name, status: d.status, timeIn: d.status === 'present' ? new Date().toLocaleTimeString() : null, timeOut: null, date: today });
              });
            } else {
              const emp = db.employees.find(e => e.name.toLowerCase().includes((d.employeeName || '').toLowerCase()));
              if (emp) {
                const existing = attToday.find(a => a.employeeId === emp.id);
                if (existing) existing.status = d.status;
                else attToday.push({ employeeId: emp.id, name: emp.name, status: d.status, timeIn: d.status === 'present' || d.status === 'late' ? new Date().toLocaleTimeString() : null, timeOut: null, date: today });
              }
            }
            needsRefresh = true;
            resultData.attendanceUpdated = true;
            break;
          }

          case 'update_stock': {
            const d = op.data;
            const mat = db.rawMaterials.find(m => m.id === d.materialId || m.name.toLowerCase().includes((d.materialId || '').toLowerCase()));
            if (mat) {
              mat.quantity = d.quantity;
              needsRefresh = true;
              resultData.stockUpdated = mat.name;
            }
            break;
          }

          case 'query': {
            const d = op.data;
            const entity = d.entity;
            const filter = d.filter || {};
            if (db[entity]) {
              let results = [...db[entity]];
              if (filter.name) results = results.filter(r => r.name?.toLowerCase().includes(filter.name.toLowerCase()));
              if (filter.status) results = results.filter(r => r.status === filter.status);
              if (filter.date) results = results.filter(r => r.date === filter.date);
              resultData[entity] = results;
            }
            break;
          }

          case 'sales_summary': {
            const totalRev = db.orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0);
            const todayOrders = db.orders.filter(o => o.date === today);
            const todayRev = todayOrders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0);
            const todayProfit = todayRev * 0.4;
            resultData.salesSummary = {
              todayRevenue: todayRev,
              todayProfit: todayProfit,
              totalRevenue: totalRev,
              activeOrders: db.orders.filter(o => o.status !== 'completed').length
            };
            break;
          }

          case 'navigate': {
            resultData.navigate = op.data.view;
            break;
          }

          case 'respond':
            break;
        }
      }

      res.json({
        success: true,
        response: responseMsg,
        resultData,
        needsRefresh,
        _rawOperations: operations
      });
      return; // success, exit the key loop

    } catch (err) {
      lastError = err.message;
      console.error('Groq API error with key:', err.message);
      continue;
    }
  }

  // All keys failed
  res.status(500).json({ success: false, error: 'AI service unavailable. ' + lastError });
});

// POST /api/assistant/launch — spawns the Python voice assistant in a new terminal window
app.post('/api/assistant/launch', async (req, res) => {
  const { spawn } = require('child_process');
  const assistantPath = path.join(__dirname, '..', 'voice_assistant', 'assistant.py');
  const pythonPath = 'C:\\Users\\pc\\AppData\\Local\\Programs\\Python\\Python314\\python.exe';

  try {
    const child = spawn('start', ['cmd', '/k', pythonPath, assistantPath], {
      shell: true,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    res.json({ success: true, message: 'Voice assistant launched in new window.' });
  } catch (err) {
    console.error('Failed to launch assistant:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Express server running on http://localhost:${PORT}`);
  await seedDefaultUsers();
  await seedDefaultData();
});
