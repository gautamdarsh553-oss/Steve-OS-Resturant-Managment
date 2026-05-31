'use strict';
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, ClipboardList, Package, Database, Users,
  CalendarCheck, Wallet, BarChart3, TrendingUp, DollarSign,
  Mic, Bell, Boxes, BookOpen, Truck, FileText, Settings,
  Menu, Shield, ShoppingCart, Plus, Minus, Trash2,
  X, Check, AlertTriangle, Play, Sparkles, Send, Download, Printer, CreditCard
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

export default function Home() {
  // App views & state
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeRole, setActiveRole] = useState('admin');
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Database states
  const [menuItems, setMenuItems] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [analyticsSummary, setAnalyticsSummary] = useState({ totalRevenue: 0, totalProfit: 0, orderCount: 0, todayRevenue: 0, todayProfit: 0, todayOrderCount: 0 });
  const [analyticsTrends, setAnalyticsTrends] = useState([]);

  // POS Cart State
  const [posCart, setPosCart] = useState([]);
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [selectedPosCategory, setSelectedPosCategory] = useState('All');
  const [printedReceipt, setPrintedReceipt] = useState(null);

  // Sales Management State
  const [editingOrder, setEditingOrder] = useState(null);
  const [salesSearch, setSalesSearch] = useState('');

  // Daily Startup Stock State
  const [showStockSetup, setShowStockSetup] = useState(false);
  const [stockSetupValues, setStockSetupValues] = useState({});

  // Voice Assistant Steve State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [steveStatus, setSteveStatus] = useState('idle');
  const [steveLogs, setSteveLogs] = useState([
    { id: 1, text: "Hi, I am Steve. Say 'Hey Steve...' or click a simulator command.", sender: 'steve', time: 'System' }
  ]);
  const [interimSpeech, setInterimSpeech] = useState('');

  // Biometric Simulator State
  const [selectedBioEmployee, setSelectedBioEmployee] = useState('');

  // Stripe Payroll Callback states
  const [payoutSuccessData, setPayoutSuccessData] = useState(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const recognitionRef = useRef(null);
  const voiceActiveRef = useRef(false);
  const restartTimeoutRef = useRef(null);

  // ==================== FETCH DATABASE FUNCTION ====================
  const fetchData = async () => {
    try {
      const menuRes = await fetch(`${API_BASE}/api/menu`);
      const menuData = await menuRes.json();
      setMenuItems(Array.isArray(menuData) ? menuData : []);

      const invRes = await fetch(`${API_BASE}/api/inventory`);
      const invData = await invRes.json();
      setRawMaterials(Array.isArray(invData) ? invData : []);

      const ordRes = await fetch(`${API_BASE}/api/orders`);
      const ordData = await ordRes.json();
      setOrders(Array.isArray(ordData) ? ordData : []);

      const empRes = await fetch(`${API_BASE}/api/employees`);
      const empData = await empRes.json();
      setEmployees(Array.isArray(empData) ? empData : []);
      if (Array.isArray(empData) && empData.length > 0 && !selectedBioEmployee) {
        setSelectedBioEmployee(empData[0].id);
      }

      const attRes = await fetch(`${API_BASE}/api/attendance`);
      const attData = await attRes.json();
      setAttendance(Array.isArray(attData) ? attData : []);

      // Fetch Dynamic Analytics
      const sumRes = await fetch(`${API_BASE}/api/analytics/summary`);
      const sumData = await sumRes.json();
      setAnalyticsSummary(sumData);

      const trendRes = await fetch(`${API_BASE}/api/analytics/trends`);
      const trendData = await trendRes.json();
      setAnalyticsTrends(trendData);

      // Fetch AI Low Stock Alerts
      const alertRes = await fetch(`${API_BASE}/api/inventory/alerts`);
      const alertData = await alertRes.json();
      setNotifications(Array.isArray(alertData) ? alertData : []);
    } catch (err) {
      console.warn("Could not load backend datasets. Check server is running on " + API_BASE, err);
    }
  };

  // ==================== STRIPE PAYOUT SYSTEM VERIFICATION ====================
  const verifyStripePayout = async (employeeId, amount, sessionId) => {
    try {
      const response = await fetch(`${API_BASE}/api/stripe/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock_auth_token_admin'
        },
        body: JSON.stringify({ employeeId, amount, sessionId })
      });
      const data = await response.json();
      if (data.success) {
        setPayoutSuccessData({
          employeeId,
          amount,
          sessionId,
          date: new Date().toLocaleDateString()
        });
        fetchData();
      }
    } catch(err) {
      console.error("Payout verification error:", err);
    }
  };

  const closePayoutModal = () => {
    setPayoutSuccessData(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const addSteveLog = (text, sender) => {
    setSteveLogs(prev => [
      ...prev,
      { id: prev.length + 1, text, sender, time: new Date().toTimeString().split(' ')[0].substring(0, 5) }
    ]);
  };

  // ==================== WAKE CHIMES WEB AUDIO SYNTHESIZER ====================
  const playWakeChime = (type = 'wake') => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'wake') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(987, ctx.currentTime);
        osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch(err) {
      console.warn("Dynamic Audio context chime failed.", err);
    }
  };

  const speakFeedback = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  // ==================== VOICE COMMAND INTERPRETER (NLP PARSER) ====================
  const processVoiceCommand = async (command) => {
    console.log("Steve OS interpreting command sentence:", command);
    addSteveLog(command, 'user');
    setInterimSpeech('');

    const attRegex = /mark\s+([a-zA-Z\s]+)\s+(present|absent|late)/i;
    const attMatch = command.match(attRegex);
    if (attMatch) {
      const name = attMatch[1].trim();
      const status = attMatch[2].toLowerCase();
      const emp = employees.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (emp) {
        const url = status === 'present' ? 'clockin' : 'clockout';
        const response = await fetch(`${API_BASE}/api/attendance/${url}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: emp.id })
        });
        const logData = await response.json();
        if (logData.id || logData.date) {
          const msg = `Success. Clocked ${emp.name} in attendance list as present.`;
          playWakeChime('success');
          speakFeedback(msg);
          addSteveLog(msg, 'steve');
          fetchData();
        }
      } else {
        const msg = `Employee ${name} not found in roster files.`;
        playWakeChime('error');
        speakFeedback(msg);
        addSteveLog(msg, 'steve');
      }
      return;
    }

    if (command.includes("complete") || command.includes("completed")) {
      const targetMatch = command.match(/table\s*(\d+)|takeaway\s*(\d+)/i);
      if (targetMatch) {
        const label = targetMatch[1] ? `Table ${targetMatch[1]}` : `Takeaway ${targetMatch[2]}`;
        const activeOrder = orders.find(o => o.table_label.toLowerCase() === label.toLowerCase() && o.status !== 'completed');
        if (activeOrder) {
          const response = await fetch(`${API_BASE}/api/orders/${activeOrder.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
          });
          const data = await response.json();
          if (data.id) {
            const msg = `Successfully completed order ${activeOrder.id} for ${label}.`;
            playWakeChime('success');
            speakFeedback(msg);
            addSteveLog(msg, 'steve');
            fetchData();
          }
        } else {
          const msg = `No active order found for ${label} queue.`;
          playWakeChime('error');
          speakFeedback(msg);
          addSteveLog(msg, 'steve');
        }
      }
      return;
    }

    if (command.includes("sales") || command.includes("profit") || command.includes("revenue")) {
      const todayStr = new Date().toISOString().split('T')[0];
      const completedToday = orders.filter(o => o.date === todayStr && o.status === 'completed');
      const salesVal = completedToday.reduce((sum, o) => sum + o.total, 0);
      const msg = `Today's net sales are $${salesVal.toFixed(2)} with ${completedToday.length} completed transactions.`;
      playWakeChime('success');
      speakFeedback(msg);
      addSteveLog(msg, 'steve');
      return;
    }

    if (command.includes("low stock") || command.includes("shortage")) {
      if (notifications.length > 0) {
        const names = notifications.map(n => n.message.split(" ")[0]).join(", ");
        const msg = `The following raw materials are currently running low: ${names}.`;
        playWakeChime('success');
        speakFeedback(msg);
        addSteveLog(msg, 'steve');
      } else {
        const msg = "All raw ingredients stock levels are safe.";
        playWakeChime('success');
        speakFeedback(msg);
        addSteveLog(msg, 'steve');
      }
      return;
    }

    if (command.includes("reset stock") || command.includes("restore inventory")) {
      const msg = "I am unable to reset stock via voice for security reasons. Please use the Inventory Manager panel.";
      playWakeChime('error');
      speakFeedback(msg);
      addSteveLog(msg, 'steve');
      return;
    }

    const numberMap = { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1, an: 1 };
    const parsedItems = [];

    const orderParts = command.split(/and|,/).map(p => p.trim()).filter(Boolean);

    orderParts.forEach(part => {
      const itemMatch = part.match(/(\d+|one|two|three|four|five|a|an)?\s*(.*)/i);
      if (itemMatch) {
        const qtyStr = itemMatch[1] || "1";
        const qty = isNaN(qtyStr) ? (numberMap[qtyStr.toLowerCase()] || 1) : parseInt(qtyStr);
        const rawName = itemMatch[2].trim().toLowerCase();

        const cleanName = rawName.replace(/\b(please|thanks|thank you|please|the|a|an)\b/g, '').trim();

        let targetItem = null;
        let bestScore = 0;

        menuItems.forEach(m => {
          const mn = m.name.toLowerCase();
          const wordsMatch = cleanName.split(/\s+/).some(w => mn.includes(w) && w.length > 2);
          const mnWordsMatch = mn.split(/\s+/).some(w => cleanName.includes(w) && w.length > 2);
          const fullMatch = cleanName.includes(mn) || mn.includes(cleanName);

          if (fullMatch || wordsMatch || mnWordsMatch) {
            const score = Math.max(
              cleanName.includes(mn) ? mn.length / cleanName.length : 0,
              mn.includes(cleanName) ? cleanName.length / mn.length : 0,
              wordsMatch ? 0.6 : 0,
              mnWordsMatch ? 0.6 : 0
            );
            if (score > bestScore) {
              bestScore = score;
              targetItem = m;
            }
          }
        });

        if (targetItem) {
          parsedItems.push({
            itemId: targetItem.id,
            name: targetItem.name,
            quantity: qty,
            price: targetItem.sellingPrice
          });
        }
      }
    });

    if (parsedItems.length > 0) {
      const tableMatch = command.match(/table\s*(\d+)/i);
      const tableLabel = tableMatch ? `Table ${tableMatch[1]}` : 'Takeaway';
      const total = parsedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: tableLabel,
          items: parsedItems,
          total,
          order_source: 'Voice',
          payment_method: 'Cash',
          employee_name: 'Steve Assistant'
        })
      });
      const orderData = await response.json();
      if (orderData.id) {
        const itemText = parsedItems.map(it => `${it.quantity} ${it.name}`).join(" and ");
        const feedback = `Order created for ${itemText} assigned to ${tableLabel}.`;
        playWakeChime('success');
        speakFeedback(feedback);
        addSteveLog(feedback, 'steve');
        fetchData();
      } else {
        const msg = `Could not create order: ${orderData.error || 'Unknown error'}`;
        playWakeChime('error');
        speakFeedback(msg);
        addSteveLog(msg, 'steve');
      }
    } else {
      const msg = "I couldn't match any food items. Try: 'Hey Steve, two chicken burgers and one pizza'.";
      playWakeChime('error');
      speakFeedback(msg);
      addSteveLog(msg, 'steve');
    }
  };

  useEffect(() => {
    fetchData();

    const pollInterval = setInterval(fetchData, 5000);

    const dailySetup = localStorage.getItem('steve_last_daily_setup');
    const todayStr = new Date().toISOString().split('T')[0];
    if (dailySetup !== todayStr) {
      setShowStockSetup(true);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const employeeId = urlParams.get('employee_id');
    const amount = urlParams.get('amount');

    if (sessionId && employeeId && amount) {
      verifyStripePayout(employeeId, amount, sessionId);
    }

    return () => clearInterval(pollInterval);
  }, []);

  // Web Speech API Voice Initialization
  useEffect(() => {
    voiceActiveRef.current = isVoiceActive;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addSteveLog("Speech recognition not supported in this browser. Try Chrome.", 'steve');
      return;
    }

    if (recognitionRef.current) {
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    let wakeTriggered = false;
    let restartAttempts = 0;

    rec.onstart = () => {
      setSteveStatus('listening');
      restartAttempts = 0;
    };

    rec.onend = () => {
      if (voiceActiveRef.current) {
        const delay = Math.min(500 + restartAttempts * 200, 3000);
        restartAttempts++;
        restartTimeoutRef.current = setTimeout(() => {
          try {
            rec.start();
          } catch (e) {
            console.error("Voice restart error:", e);
          }
        }, delay);
      } else {
        setSteveStatus('idle');
        restartAttempts = 0;
      }
    };

    rec.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setSteveStatus('idle');
        addSteveLog('Microphone access denied. Please allow microphone permissions in browser settings.', 'steve');
        return;
      }
      if (event.error === 'aborted') return;
      console.warn("Speech error:", event.error);
    };

    let wakeTextTimeout = null;

    rec.onresult = (event) => {
      let interimText = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const confidence = event.results[i][0].confidence;
          if (confidence > 0.3) {
            final += event.results[i][0].transcript;
          }
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      const interimLower = interimText.toLowerCase();
      setInterimSpeech(final || interimLower);

      if (!wakeTriggered && (final || interimText)) {
        const text = (final || interimText).toLowerCase();
        if (text.includes("hey steve") || text.includes("hey, steve")) {
          wakeTriggered = true;
          playWakeChime();
          setSteveStatus('steve_listening');

          const parts = text.split(/hey steve|hey, steve/);
          const command = parts[parts.length - 1].trim();
          if (command.length > 2) {
            processVoiceCommand(command);
          }

          clearTimeout(wakeTextTimeout);
          wakeTextTimeout = setTimeout(() => {
            wakeTriggered = false;
          }, 8000);
        }
      }
    };

    recognitionRef.current = rec;
  }, []);

  // Handle voice listening toggles
  useEffect(() => {
    voiceActiveRef.current = isVoiceActive;
    const rec = recognitionRef.current;

    if (rec) {
      if (isVoiceActive) {
        try {
          rec.start();
        } catch(e) {
          try {
            rec.stop();
          } catch(_) {}
          setTimeout(() => {
            try { rec.start(); } catch(_) {}
          }, 300);
        }
      } else {
        try {
          rec.stop();
        } catch(e) {}
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = null;
        }
      }
    }
  }, [isVoiceActive]);



  // ==================== MANUAL POS CART MANAGEMENT ====================
  const addToPosCart = (item) => {
    setPosCart(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateCartQty = (itemId, change) => {
    setPosCart(prev => {
      return prev.map(i => {
        if (i.id === itemId) {
          const next = i.quantity + change;
          return next <= 0 ? null : { ...i, quantity: next };
        }
        return i;
      }).filter(Boolean);
    });
  };

  const handlePOSCheckout = async () => {
    if (posCart.length === 0) return;
    const total = posCart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const parsedItems = posCart.map(i => ({
      itemId: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.sellingPrice
    }));

    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'POS Counter',
          items: parsedItems,
          total,
          order_source: 'POS',
          payment_method: 'Card',
          employee_name: 'POS Cashier'
        })
      });
      const data = await response.json();
      if (data.id) {
        setPrintedReceipt({
          orderId: data.id,
          date: data.date,
          time: data.time,
          items: parsedItems,
          total
        });
        setPosCart([]);
        fetchData();
        playWakeChime('success');
      }
    } catch(err) {
      console.error(err);
    }
  };

  // ==================== SALES PORTAL WORKFLOWS ====================
  const handleStartEditSale = (order) => {
    setEditingOrder({
      ...order,
      itemsJson: JSON.stringify(order.items, null, 2)
    });
  };

  const handleAddManualSale = async () => {
    const orderId = prompt("Enter manual Order ID (e.g., MAN-001):");
    const amount = parseFloat(prompt("Enter order amount ($):"));
    const source = prompt("Enter order source (Manual/Cash/Voice):") || 'Manual';
    if (!orderId || !amount) return;
    const now = new Date();
    const time = now.toTimeString().split(' ')[0].substring(0, 5);
    const date = now.toISOString().split('T')[0];
    try {
      await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'Manual Entry',
          items: [{ itemId: 'manual', name: 'Manual Sale', quantity: 1, price: amount }],
          total: amount,
          order_source: source,
          payment_method: 'Cash',
          employee_name: 'Admin',
          notes: `Manual sale entry - ${orderId}`
        })
      });
      fetchData();
    } catch(err) {
      console.error(err);
    }
  };

  const handleSaveEditSale = async (e) => {
    e.preventDefault();
    try {
      const parsedItems = JSON.parse(editingOrder.itemsJson);
      const nextTotal = parsedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

      const response = await fetch(`${API_BASE}/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_label: editingOrder.table_label,
          items: parsedItems,
          total: nextTotal,
          payment_method: editingOrder.payment_method,
          employee_name: editingOrder.employee_name,
          notes: editingOrder.notes
        })
      });
      const data = await response.json();
      if (data.id) {
        setEditingOrder(null);
        fetchData();
      }
    } catch (err) {
      alert("Invalid JSON format for items array structure.");
    }
  };

  const handleDeleteSale = async (orderId) => {
    if (confirm(`Delete sale ${orderId} permanently?`)) {
      await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'DELETE'
      });
      fetchData();
    }
  };

  const handleRefundSale = async (orderId) => {
    if (confirm(`Refund transaction ${orderId}?`)) {
      await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'refunded' })
      });
      fetchData();
    }
  };

  // ==================== BIOMETRIC ATTENDANCE HANDLERS ====================
  const handleBioClockIn = async () => {
    if (!selectedBioEmployee) return;
    try {
      await fetch(`${API_BASE}/api/attendance/clockin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedBioEmployee })
      });
      fetchData();
      playWakeChime('success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleBioClockOut = async () => {
    if (!selectedBioEmployee) return;
    try {
      await fetch(`${API_BASE}/api/attendance/clockout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedBioEmployee })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // ==================== DAILY BASELINE SETUP ====================
  const handleStockSetupSubmit = async (e) => {
    e.preventDefault();
    const updated = {};
    rawMaterials.forEach(m => {
      updated[m.id] = stockSetupValues[m.id] !== undefined ? stockSetupValues[m.id] : m.quantity;
    });

    const response = await fetch(`${API_BASE}/api/inventory/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockValues: updated })
    });
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('steve_last_daily_setup', new Date().toISOString().split('T')[0]);
      setShowStockSetup(false);
      fetchData();
    }
  };

  // ==================== STRIPE SALARIES PAYOUT element ====================
  const handlePayEmployeeSalary = async (employeeId, amount) => {
    try {
      const response = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock_auth_token_admin'
        },
        body: JSON.stringify({ employeeId, salaryAmount: amount })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env");
      }
    } catch(err) {
      console.error(err);
    }
  };

  // ==================== ANALYTICS GRAPH CALCULATIONS ====================
  const getRechartsSalesData = () => {
    return analyticsTrends;
  };

  // Finance summaries
  const todayStr = new Date().toISOString().split('T')[0];
  const completedToday = orders.filter(o => o.date === todayStr && o.status === 'completed');
  const revenueToday = completedToday.reduce((acc, curr) => acc + curr.total, 0);
  const profitToday = completedToday.reduce((acc, curr) => {
    // Exact profits calculated from items
    let ordProfit = 0;
    curr.items.forEach(it => {
      const menu = menuItems.find(m => m.id === it.itemId);
      if (menu) ordProfit += (menu.profit * it.quantity);
    });
    return acc + ordProfit;
  }, 0);

  const activeOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'cooking').length;
  
  // Total Lifetime sums
  const completedTotalOrders = orders.filter(o => o.status === 'completed');
  const lifetimeRevenue = completedTotalOrders.reduce((sum, o) => sum + o.total, 0);
  const lifetimeProfit = completedTotalOrders.reduce((sum, o) => {
    let p = 0;
    o.items.forEach(it => {
      const menu = menuItems.find(m => m.id === it.itemId);
      if (menu) p += (menu.profit * it.quantity);
    });
    return sum + p;
  }, 0);

  const pendingPayrollSum = employees.filter(e => e.payment_status === 'Unpaid').reduce((sum, e) => sum + e.salary_amount, 0);
  const paidPayrollSum = employees.filter(e => e.payment_status === 'Paid').reduce((sum, e) => sum + e.salary_amount, 0);

  // Employee Management State
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [empFormData, setEmpFormData] = useState({
    name: '', role: 'Chef', hourlyRate: 0, shift: '08:00 - 16:00', bankName: '', bankAccount: '', salaryAmount: 0
  });

  const handleEmpSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingEmp ? `${API_BASE}/api/employees/${editingEmp.id}` : `${API_BASE}/api/employees`;
      const method = editingEmp ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock_auth_token_admin'
        },
        body: JSON.stringify(empFormData)
      });
      if (response.ok) {
        setShowEmpModal(false);
        setEditingEmp(null);
        setEmpFormData({ name: '', role: 'Chef', hourlyRate: 0, shift: '08:00 - 16:00', bankName: '', bankAccount: '', salaryAmount: 0 });
        fetchData();
      }
    } catch (err) {
      console.error("Employee save error:", err);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (confirm("Delete employee record permanently?")) {
      await fetch(`${API_BASE}/api/employees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer mock_auth_token_admin' }
      });
      fetchData();
    }
  };

  return (
    <div className="flex min-h-screen">
      
      {/* ==================== LEFT SIDEBAR NAVIGATION ==================== */}
      <aside className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen z-40 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 font-bold text-xl text-indigo-600 font-heading">
              <span>✨</span>
              <span>Steve OS</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-gray-500 dark:text-gray-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'pos', label: 'Manual POS Cart', icon: ShoppingCart },
            { id: 'orders', label: 'Live Orders', icon: ClipboardList },
            { id: 'sales-management', label: 'Sales Management', icon: TrendingUp },
            { id: 'inventory', label: 'Inventory Manager', icon: Package },
            { id: 'db-editor', label: 'Database Editor', icon: Database },
            { id: 'employees', label: 'Employees', icon: Users },
            { id: 'attendance', label: 'Attendance logs', icon: CalendarCheck },
            { id: 'salaries', label: 'Salary Payroll', icon: Wallet },
            { id: 'analytics', label: 'Analytics Chart', icon: BarChart3 },
            { id: 'voice-settings', label: 'Voice Assistant', icon: Mic },
            { id: 'notifications', label: 'System Notifications', icon: Bell },
            { id: 'raw-materials', label: 'Raw Materials', icon: Boxes },
            { id: 'recipes', label: 'Recipes Book', icon: BookOpen },
            { id: 'suppliers', label: 'Suppliers list', icon: Truck },
            { id: 'monthly-summary', label: 'Monthly Summary', icon: FileText },
            { id: 'settings', label: 'System Settings', icon: Settings }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-l-4 border-indigo-600 font-semibold' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ==================== RIGHT VIEW CONTAINER ==================== */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        
        {/* Top Header navbar */}
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-8 z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold capitalize font-heading dark:text-white">
              {activeView.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            
            {/* Steve Pulse badge */}
            <div 
              onClick={() => { setIsVoiceActive(!isVoiceActive); playWakeChime(); }}
              className="flex items-center gap-3 bg-slate-100 dark:bg-gray-800 px-4 py-2 rounded-full cursor-pointer hover:shadow-sm transition-all"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                steveStatus === 'listening' ? 'bg-indigo-500 pulse-listening' :
                steveStatus === 'steve_listening' ? 'bg-emerald-500 pulse-steve-listening' : 'bg-gray-400'
              }`}>
                <Mic className="w-4 h-4" />
              </div>
              <div className="text-left text-xs">
                <div className="font-semibold text-gray-800 dark:text-white">Steve Assistant</div>
                <div className="text-gray-400">{isVoiceActive ? 'Listening...' : 'Click to Wake'}</div>
              </div>
            </div>

            {/* Profile User switcher */}
            <div 
              onClick={() => setShowRoleModal(true)}
              className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border border-transparent hover:border-indigo-500 transition-all"
            >
              <Shield className="w-4 h-4" />
              <span>Role: {activeRole.toUpperCase()}</span>
            </div>

          </div>
        </header>

        {/* Dynamic view screen loader */}
        <div className="flex-1 p-8 overflow-y-auto">

          {/* ==================== VIEW: DASHBOARD ==================== */}
          {activeView === 'dashboard' && (
            <div className="flex flex-col gap-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-panel glass-panel-hover p-6 flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Today's Sales</span>
                    <span className="text-3xl font-bold dark:text-white">${analyticsSummary.todayRevenue.toFixed(2)}</span>
                    <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">From real POS/Voice orders</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600"><DollarSign className="w-6 h-6" /></div>
                </div>

                <div className="glass-panel glass-panel-hover p-6 flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Profit Today</span>
                    <span className="text-3xl font-bold dark:text-white">${analyticsSummary.todayProfit.toFixed(2)}</span>
                    <span className="text-xs text-emerald-500 font-semibold">From completed orders only</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600"><Sparkles className="w-6 h-6" /></div>
                </div>

                <div className="glass-panel glass-panel-hover p-6 flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Orders</span>
                    <span className="text-3xl font-bold dark:text-white">{activeOrdersCount}</span>
                    <span className="text-xs text-gray-400">Pending/cooking now</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600"><ClipboardList className="w-6 h-6" /></div>
                </div>

                <div className="glass-panel glass-panel-hover p-6 flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Low Stock Warnings</span>
                    <span className={`text-3xl font-bold ${notifications.length > 0 ? 'text-red-500' : 'dark:text-white'}`}>{notifications.length}</span>
                    <span className="text-xs text-gray-400">Inventory alerts active</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600"><AlertTriangle className="w-6 h-6" /></div>
                </div>
              </div>

              {/* Recharts Analytics curve */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 md:col-span-2 flex flex-col gap-4">
                  <h3 className="text-lg font-semibold dark:text-white">Dynamic Sales Analytics Graph</h3>
                  <div className="h-80 w-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getRechartsSalesData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Heuristic AI Insights block */}
                <div className="glass-panel p-6 flex flex-col gap-6">
                  <h3 className="text-lg font-semibold dark:text-white">🤖 AI Business Insights</h3>
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-gray-800 flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase">Demand Insights</span>
                      <span className="text-sm font-semibold dark:text-white">
                        {orders.length > 0
                          ? (() => {
                              const itemCounts = {};
                              orders.filter(o => o.status === 'completed').forEach(o => (o.items || []).forEach(it => { itemCounts[it.name] = (itemCounts[it.name] || 0) + it.quantity; }));
                              const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
                              return topItem ? `Top seller: ${topItem[0]} (${topItem[1]} sold)` : "Analyzing order patterns...";
                            })()
                          : "No orders recorded yet. Start selling!"}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-gray-800 flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase">Critical Depletion warning</span>
                      <span className={`text-sm font-semibold ${notifications.length > 0 ? 'text-red-500' : 'dark:text-white'}`}>
                        {notifications.length > 0 ? notifications[0].message : "All stock levels safe."}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-gray-800 flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase">Peak Work Hours</span>
                      <span className="text-sm font-semibold dark:text-white">
                        {orders.length > 0
                          ? (() => {
                              const hours = {};
                              orders.filter(o => o.status === 'completed').forEach(o => {
                                const hour = o.time ? o.time.split(':')[0] : '00';
                                hours[hour] = (hours[hour] || 0) + 1;
                              });
                              const sorted = Object.entries(hours).sort((a, b) => b[1] - a[1]);
                              if (sorted.length >= 2) {
                                return `${sorted[0][0]}:00 - ${parseInt(sorted[0][0])+1}:00 & ${sorted[1][0]}:00 - ${parseInt(sorted[1][0])+1}:00`;
                              } else if (sorted.length === 1) {
                                return `${sorted[0][0]}:00 - ${parseInt(sorted[0][0])+1}:00`;
                              }
                              return "Insufficient data to determine peak hours.";
                            })()
                          : "No data yet. Orders will appear here."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== VIEW: POS MANUAL SYSTEM ==================== */}
          {activeView === 'pos' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
              <div className="md:col-span-2 flex flex-col gap-6">
                <div className="glass-panel p-6 flex items-center justify-between gap-4">
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    className="flex-1 bg-slate-100 dark:bg-gray-800 text-sm p-3 rounded-lg border-none outline-none dark:text-white"
                    value={posSearchQuery}
                    onChange={(e) => setPosSearchQuery(e.target.value)}
                  />
                  <div className="flex gap-2">
                    {['All', 'Burgers', 'Pizzas', 'Sides', 'Drinks'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedPosCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedPosCategory === cat
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick-Add Popular Items */}
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quick-Add Popular</span>
                  <div className="grid grid-cols-4 gap-3">
                    {menuItems.slice(0, 4).map(item => (
                      <button
                        key={`quick-${item.id}`}
                        onClick={() => addToPosCart(item)}
                        className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-500 transition-all flex flex-col items-center gap-1"
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-[10px] font-bold dark:text-white truncate w-full text-center">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {menuItems.filter(item => {
                    const matchesSearch = item.name.toLowerCase().includes(posSearchQuery.toLowerCase());
                    const matchesCat = selectedPosCategory === 'All' || item.category === selectedPosCategory;
                    return matchesSearch && matchesCat;
                  }).map(item => (
                    <div
                      key={item.id}
                      onClick={() => addToPosCart(item)}
                      className="glass-panel glass-panel-hover p-5 flex items-center gap-4 cursor-pointer"
                    >
                      <span className="text-4xl">{item.icon || '🍔'}</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-md dark:text-white">{item.name}</h4>
                        <span className="text-xs text-gray-400">{item.category}</span>
                        <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-1">${item.sellingPrice.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shopping Cart checkout */}
              <div className="glass-panel p-6 flex flex-col justify-between h-[450px]">
                <div className="flex flex-col gap-4 overflow-y-auto">
                  <h3 className="font-bold text-lg border-b pb-2 dark:text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" /> Active Receipt Cart
                  </h3>
                  
                  {posCart.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 text-sm">Cart empty. Select items to add.</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {posCart.map(item => (
                        <div key={item.id} className="flex justify-between items-center gap-2 text-sm">
                          <span className="flex-1 font-semibold dark:text-white">{item.name}</span>
                          <div className="flex items-center gap-2 border rounded-lg px-2 py-0.5">
                            <button onClick={() => updateCartQty(item.id, -1)} className="text-gray-400"><Minus className="w-3.5 h-3.5" /></button>
                            <span className="w-4 text-center font-bold dark:text-white">{item.quantity}</span>
                            <button onClick={() => updateCartQty(item.id, 1)} className="text-gray-400"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                          <span className="w-16 text-right font-bold">${(item.sellingPrice * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg mb-4 dark:text-white">
                    <span>Total sum:</span>
                    <span>${posCart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={handlePOSCheckout}
                    disabled={posCart.length === 0}
                    className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    Process Checkout & Print Receipt
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== VIEW: KITCHEN BOARD ==================== */}
          {activeView === 'orders' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white border-b pb-2">Active Kitchen orders</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {orders.filter(o => o.status !== 'completed' && o.status !== 'refunded').map(order => (
                  <div key={order.id} className="glass-panel p-5 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-bold text-slate-800 dark:text-white">Order #{order.id}</span>
                        <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-semibold">{order.table_label}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 block">Source: {order.order_source} • Placed: {order.time}</span>
                      
                      <div className="flex flex-col gap-2 mt-3">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">{it.quantity}x {it.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t pt-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        order.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                      }`}>{order.status}</span>
                      
                      <div className="flex gap-2">
                        {order.status === 'pending' ? (
                          <button 
                            onClick={async () => {
                              await fetch(`${API_BASE}/api/orders/${order.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'cooking' })
                              });
                              fetchData();
                            }}
                            className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                          >
                            Start Cook
                          </button>
                        ) : (
                          <button 
                            onClick={async () => {
                              await fetch(`${API_BASE}/api/orders/${order.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'completed' })
                              });
                              fetchData();
                              playWakeChime('success');
                            }}
                            className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                          >
                            Mark Done
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== VIEW: SALES MANAGEMENT (CRITICAL UPDATE) ==================== */}
          {activeView === 'sales-management' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <div className="flex justify-between items-center gap-4">
                <input 
                  type="text"
                  placeholder="Search sales records by Order ID..."
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  className="bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg outline-none text-sm w-80 dark:text-white"
                />
                <button onClick={handleAddManualSale} className="btn btn-primary">+ Add Manual Sale</button>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Source</th>
                      <th>Table</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Employee</th>
                      <th>Method</th>
                      <th>Date / Time</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter(o => o.id.includes(salesSearch)).map(order => (
                      <tr key={order.id}>
                        <td><strong>#{order.id}</strong></td>
                        <td><span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 px-2 py-0.5 rounded-full">{order.order_source}</span></td>
                        <td>{order.table_label}</td>
                        <td className="text-xs">{order.items ? order.items.map(it => `${it.quantity}x ${it.name}`).join(', ') : '—'}</td>
                        <td><strong>${order.total.toFixed(2)}</strong></td>
                        <td className="text-xs">{order.employee_name || '—'}</td>
                        <td>{order.payment_method}</td>
                        <td className="text-xs">{order.date} • {order.time}</td>
                        <td>
                          <span className={`badge ${
                            order.status === 'completed' ? 'badge-completed' :
                            order.status === 'refunded' ? 'badge-danger' : 'badge-pending'
                          }`}>{order.status}</span>
                        </td>
                        <td className="text-xs max-w-[120px] truncate" title={order.notes}>{order.notes || '—'}</td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => handleStartEditSale(order)} className="btn btn-secondary py-1 px-2 text-xs">Edit</button>
                            <button onClick={() => handleRefundSale(order.id)} disabled={order.status === 'refunded'} className="btn btn-danger py-1 px-2 text-xs disabled:opacity-50">Refund</button>
                            <button onClick={() => handleDeleteSale(order.id)} className="btn btn-danger py-1 px-2 text-xs"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== VIEW: INVENTORY REGISTER ==================== */}
          {activeView === 'inventory' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-lg dark:text-white">Active inventory forecasting</h3>
                <button 
                  onClick={() => {
                    const setup = {};
                    rawMaterials.forEach(m => setup[m.id] = m.quantity);
                    setStockSetupValues(setup);
                    setShowStockSetup(true);
                  }}
                  className="btn btn-primary"
                >
                  Daily Stock update check-in
                </button>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Available Level</th>
                      <th>Minimum Threshold</th>
                      <th>Unit Cost</th>
                      <th>Forecast Runout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawMaterials.map(mat => {
                      const hourlyRates = { chicken: 0.8, cheese: 0.5, flour: 0.6, potatoes: 1.2, sauce: 0.3, oil: 0.2, bun: 4, bottles: 5, eggs: 5, boxes: 3 };
                      const useRate = hourlyRates[mat.id] || 0.1;
                      const hours = mat.quantity / useRate;
                      
                      return (
                        <tr key={mat.id}>
                          <td><strong>{mat.name}</strong></td>
                          <td><span className={mat.quantity <= mat.minStock ? 'text-red-500 font-bold' : ''}>{mat.quantity} {mat.unit}</span></td>
                          <td>{mat.minStock} {mat.unit}</td>
                          <td>${mat.cost_per_unit.toFixed(2)}</td>
                          <td><strong>{hours > 48 ? 'Stable (> 2 Days)' : `${hours.toFixed(1)} hours`}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== VIEW: DATABASE EDITOR ==================== */}
          {activeView === 'db-editor' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white">Restaurant Database editor</h3>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Prep Time</th>
                      <th>Recipe instructions</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuItems.map(item => (
                      <tr key={item.id}>
                        <td className="text-3xl">{item.icon}</td>
                        <td><strong>{item.name}</strong></td>
                        <td>{item.category}</td>
                        <td><strong>${item.sellingPrice.toFixed(2)}</strong></td>
                        <td>{item.prepTime} mins</td>
                        <td className="max-w-xs truncate">{item.instructions}</td>
                        <td>
                          <button 
                            onClick={async () => {
                              if (confirm("Delete menu item?")) {
                                await fetch(`${API_BASE}/api/menu/${item.id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer mock_auth' } });
                                fetchData();
                              }
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== VIEW: EMPLOYEES ==================== */}
          {activeView === 'employees' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-lg dark:text-white">Staff directory</h3>
                <button onClick={() => { setEditingEmp(null); setEmpFormData({ name: '', role: 'Chef', hourlyRate: 0, shift: '08:00 - 16:00', bankName: '', bankAccount: '', salaryAmount: 0 }); setShowEmpModal(true); }} className="btn btn-primary">Add Employee</button>
              </div>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Shift</th>
                      <th>Rating</th>
                      <th>Bank Details</th>
                      <th>Salary Amount</th>
                      <th>Stripe status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td><strong>{emp.name}</strong></td>
                        <td>{emp.role}</td>
                        <td>{emp.shift}</td>
                        <td><strong>{emp.rating * 20}%</strong></td>
                        <td className="text-xs">{emp.bank_name} ({emp.bank_account})</td>
                        <td><strong>${emp.salary_amount.toFixed(2)}</strong></td>
                        <td><span className={`badge ${emp.payment_status === 'Paid' ? 'badge-completed' : 'badge-pending'}`}>{emp.payment_status}</span></td>
                        <td>
                          <button onClick={() => handleDeleteEmployee(emp.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== VIEW: ATTENDANCE LOGS ==================== */}
          {activeView === 'attendance' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
              <div className="md:col-span-2 glass-panel p-6">
                <h3 className="font-bold text-lg dark:text-white mb-4">Today's clock sheets</h3>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Time Clock In</th>
                        <th>Time Clock Out</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => {
                        const log = attendance.find(a => a.employee_id === emp.id);
                        return (
                          <tr key={emp.id}>
                            <td><strong>{emp.name}</strong></td>
                            <td>{log ? log.time_in : '—'}</td>
                            <td>{log ? (log.time_out || 'Active') : '—'}</td>
                            <td><span className={`badge ${log ? 'badge-completed' : 'badge-danger'}`}>{log ? 'Present' : 'Absent'}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Biometric Integration panel */}
              <div className="glass-panel p-6 flex flex-col gap-4">
                <h3 className="font-bold text-lg dark:text-white">Biometric Scanner Simulator</h3>
                <div className="form-group">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Select Employee profile</label>
                  <select 
                    value={selectedBioEmployee}
                    onChange={(e) => setSelectedBioEmployee(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-gray-800 p-3 rounded-lg outline-none mt-2 dark:text-white"
                  >
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <button onClick={handleBioClockIn} className="btn btn-primary py-3">Clock In</button>
                  <button onClick={handleBioClockOut} className="btn btn-secondary py-3">Clock Out</button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== VIEW: STRIPE PAYROLL MANAGER (NEW INTEGRATION) ==================== */}
          {activeView === 'salaries' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-indigo-500">Unpaid Payroll amount</span>
                    <span className="text-2xl font-bold dark:text-white">${pendingPayrollSum.toFixed(2)}</span>
                  </div>
                  <Wallet className="w-10 h-10 text-indigo-600" />
                </div>
                <div className="p-5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-emerald-500">Salary Expenses paid</span>
                    <span className="text-2xl font-bold dark:text-white">${paidPayrollSum.toFixed(2)}</span>
                  </div>
                  <Check className="w-10 h-10 text-emerald-600" />
                </div>
                <div className="p-5 bg-slate-100 dark:bg-gray-800 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-500">Total Operational Budget</span>
                    <span className="text-2xl font-bold dark:text-white">${(lifetimeRevenue - paidPayrollSum).toFixed(2)}</span>
                  </div>
                  <TrendingUp className="w-10 h-10 text-slate-600" />
                </div>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Staff Employee</th>
                      <th>Bank account Details</th>
                      <th>Due payroll amount</th>
                      <th>Payment Status</th>
                      <th>Last Transferred Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td>
                          <strong>{emp.name}</strong>
                          <span className="block text-[10px] text-gray-400">{emp.role}</span>
                        </td>
                        <td>{emp.bank_name} ({emp.bank_account})</td>
                        <td><strong>${emp.salary_amount.toFixed(2)}</strong></td>
                        <td><span className={`badge ${emp.payment_status === 'Paid' ? 'badge-completed' : 'badge-pending'}`}>{emp.payment_status}</span></td>
                        <td>{emp.last_payment_date}</td>
                        <td>
                          <button
                            onClick={() => handlePayEmployeeSalary(emp.id, emp.salary_amount)}
                            disabled={emp.payment_status === 'Paid'}
                            className="bg-indigo-600 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pay Salary via Stripe
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== VIEW: ANALYTICS CHART ==================== */}
          {activeView === 'analytics' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white">Sales & Net Profits analysis</h3>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getRechartsSalesData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={3} />
                    <Line type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ==================== VIEW: SALES REPORTS ==================== */}
          {activeView === 'sales-reports' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-lg dark:text-white">Completed Sales transactions</h3>
                <button 
                  onClick={() => {
                    let csv = "Order ID,Source,Table,Total ($),Method,Date,Time\r\n";
                    orders.filter(o => o.status === 'completed').forEach(o => {
                      csv += `${o.id},${o.order_source},${o.table_label},${o.total},${o.payment_method},${o.date},${o.time}\r\n`;
                    });
                    const uri = "data:text/csv;charset=utf-8," + encodeURI(csv);
                    const link = document.createElement("a");
                    link.setAttribute("href", uri);
                    link.setAttribute("download", "sales_report.csv");
                    link.click();
                  }}
                  className="btn btn-secondary"
                >
                  <Download className="w-4 h-4" /> Download Sales CSV
                </button>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Source</th>
                      <th>Table</th>
                      <th>Total Value</th>
                      <th>Method</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter(o => o.status === 'completed').map(order => (
                      <tr key={order.id}>
                        <td><strong>#{order.id}</strong></td>
                        <td><span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-600 px-2 py-0.5 rounded-full">{order.order_source}</span></td>
                        <td>{order.table_label}</td>
                        <td><strong>${order.total.toFixed(2)}</strong></td>
                        <td>{order.payment_method}</td>
                        <td>{order.date} • {order.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== VIEW: PROFIT STATEMENTS ==================== */}
          {activeView === 'profit-reports' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white">Net Operating statements</h3>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Operational Statement Group</th>
                      <th>Lifetime Sum</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Total Gross lifetime Sales</td>
                      <td><span className="text-emerald-500 font-bold">${lifetimeRevenue.toFixed(2)}</span></td>
                    </tr>
                    <tr>
                      <td>Total Ingredient Costs (estimated)</td>
                      <td><span className="text-rose-500 font-bold">-${(lifetimeRevenue * 0.38).toFixed(2)}</span></td>
                    </tr>
                    <tr>
                      <td>Processed Staff salaries payout</td>
                      <td><span className="text-rose-500 font-bold">-${paidPayrollSum.toFixed(2)}</span></td>
                    </tr>
                    <tr className="bg-indigo-50 dark:bg-indigo-950/20 font-bold">
                      <td>Projected clean Profit balance</td>
                      <td><span>${(lifetimeProfit - paidPayrollSum).toFixed(2)}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== VIEW: VOICE SETTINGS & LOG FEED ==================== */}
          {activeView === 'voice-settings' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
              <div className="glass-panel p-6 md:col-span-2 flex flex-col gap-6">
                <h3 className="font-bold text-lg dark:text-white">Continuous voice assistant settings</h3>
                
                <div className="p-4 rounded-xl border flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm dark:text-white">Always listening microphone capture</h4>
                    <p className="text-xs text-gray-400">Captures voice command scripts continuously in the background.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isVoiceActive}
                    onChange={(e) => setIsVoiceActive(e.target.checked)}
                    className="w-5 h-5 rounded cursor-pointer accent-indigo-600"
                  />
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl">
                  <h4 className="font-bold text-sm text-indigo-600">Voice Activation key phrase:</h4>
                  <span className="text-md font-bold block mt-1 dark:text-white">"Hey Steve"</span>
                  <p className="text-xs text-gray-400 mt-1">Start by saying this wake phrase, then list your order instructions.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="font-bold text-sm dark:text-white">Simulate Command inputs</h4>
                  <p className="text-xs text-gray-400">Mock assistant actions without using the microphone:</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button onClick={() => processVoiceCommand("hey steve, 1 chicken burger")} className="btn btn-secondary text-xs">"1 Chicken Burger"</button>
                    <button onClick={() => processVoiceCommand("hey steve, 2 pizzas and 3 cold drinks")} className="btn btn-secondary text-xs">"2 Pizzas & 3 Drinks"</button>
                    <button onClick={() => processVoiceCommand("hey steve, complete table 4 order")} className="btn btn-secondary text-xs">"Complete Table 4 Order"</button>
                    <button onClick={() => processVoiceCommand("hey steve, mark Rahul present")} className="btn btn-secondary text-xs">"Mark Rahul Present"</button>
                  </div>
                </div>
              </div>

              {/* Feed logs */}
              <div className="glass-panel p-6 flex flex-col justify-between h-[450px]">
                <h3 className="font-bold text-md border-b pb-2 dark:text-white flex items-center gap-2"><Mic className="w-5 h-5" /> Assistant Console</h3>
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 my-4 pr-1 text-xs">
                  {steveLogs.map(log => (
                    <div key={log.id} className={`p-3 rounded-xl max-w-[85%] ${
                      log.sender === 'user' 
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 self-end rounded-tr-none' 
                        : 'bg-slate-100 dark:bg-gray-800 dark:text-white self-start rounded-tl-none'
                    }`}>
                      <span>{log.text}</span>
                      <span className="block text-[8px] text-gray-400 text-right mt-1">{log.time}</span>
                    </div>
                  ))}
                  {interimSpeech && (
                    <div className="p-3 bg-slate-100/50 self-end rounded-xl rounded-tr-none text-[10px] text-gray-400 italic">
                      Transcribing: "{interimSpeech}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== VIEW: NOTIFICATIONS ==================== */}
          {activeView === 'notifications' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white border-b pb-2">Active System Alerts</h3>
              <div className="flex flex-col gap-3">
                {notifications.length === 0 ? (
                  <div className="text-gray-400 py-10 text-center">All inventory stock checks passed.</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="p-4 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 flex justify-between items-center">
                      <span className="text-sm font-semibold">{notif.message}</span>
                      <span className="text-xs uppercase font-bold">{notif.type}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ==================== VIEW: RAW MATERIALS ==================== */}
          {activeView === 'raw-materials' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white">Raw Material items list</h3>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th>Storage Name</th>
                      <th>Measurement Unit</th>
                      <th>Baseline Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawMaterials.map(m => (
                      <tr key={m.id}>
                        <td><code>{m.id}</code></td>
                        <td><strong>{m.name}</strong></td>
                        <td>{m.unit}</td>
                        <td><strong>${m.cost_per_unit.toFixed(2)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== VIEW: RECIPES BOOK ==================== */}
          {activeView === 'recipes' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white">Recipe Accordions</h3>
              <div className="flex flex-col gap-4">
                {menuItems.map(item => (
                  <div key={item.id} className="p-5 rounded-xl border flex flex-col gap-3 dark:border-gray-800">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-bold text-md dark:text-white">{item.icon} {item.name}</span>
                      <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-semibold">Prep time: {item.prepTime} mins</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-1">
                      <div>
                        <span className="text-xs text-gray-400 font-semibold uppercase">Required Ingredients</span>
                        <ul className="list-disc pl-5 text-sm mt-1 text-gray-700 dark:text-gray-300">
                          {item.recipe.map((r, idx) => {
                            const mat = rawMaterials.find(m => m.id === r.materialId);
                            return <li key={idx}>{mat ? mat.name : r.materialId}: <strong>{r.quantity} {mat ? mat.unit : ''}</strong></li>;
                          })}
                        </ul>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 font-semibold uppercase">Instructions</span>
                        <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">{item.instructions}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== VIEW: SUPPLIERS ==================== */}
          {activeView === 'suppliers' && (
            <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white">Active Suppliers list</h3>
              <div className="p-8 text-center text-gray-400">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No suppliers added yet. Use the backend or database editor to add supplier records.</p>
              </div>
            </div>
          )}

          {/* ==================== VIEW: MONTHLY SUMMARY REPORT ==================== */}
          {activeView === 'monthly-summary' && (
            <div className="glass-panel p-8 max-w-xl mx-auto flex flex-col gap-6 text-center animate-fade-in">
              <span className="text-5xl">📊</span>
              <h3 className="font-bold text-xl dark:text-white">Monthly Restaurant Financial Statement</h3>
              <p className="text-xs text-gray-400">Summarizes operational transactions, cogs costs, and processed salaries to verify net margins.</p>
              
              <div className="border rounded-xl p-6 text-left flex flex-col gap-4 dark:border-gray-800">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm dark:text-gray-300">Lifetime Restaurant Sales:</span>
                  <span className="font-bold dark:text-white">${lifetimeRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm dark:text-gray-300">Raw materials cogs:</span>
                  <span className="font-bold text-rose-500">-${(lifetimeRevenue * 0.38).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm dark:text-gray-300">Stripe Payroll payouts:</span>
                  <span className="font-bold text-rose-500">-${paidPayrollSum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-bold text-lg">
                  <span className="dark:text-white">Net Income projection:</span>
                  <span className="text-emerald-500">${(lifetimeProfit - paidPayrollSum).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-center gap-4">
                <button onClick={() => window.print()} className="btn btn-primary py-2.5 px-6">Print Statement</button>
              </div>
            </div>
          )}

          {/* ==================== VIEW: GLOBAL SETTINGS ==================== */}
          {activeView === 'settings' && (
            <div className="glass-panel p-6 max-w-xl flex flex-col gap-6 animate-fade-in">
              <h3 className="font-bold text-lg dark:text-white border-b pb-2">System Parameters</h3>
              
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl border flex items-center justify-between dark:border-gray-800">
                  <div>
                    <h4 className="font-bold text-sm dark:text-white">Default interface Language</h4>
                    <p className="text-xs text-gray-400">Currently active language translation pack.</p>
                  </div>
                  <select className="bg-slate-100 dark:bg-gray-800 p-2 rounded-lg text-xs outline-none dark:text-white">
                    <option value="en">English (US)</option>
                    <option value="es">Español</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl border flex flex-col gap-3 dark:border-gray-800 mt-4">
                  <h4 className="font-bold text-sm text-red-500">Danger Zone</h4>
                  <p className="text-xs text-gray-400">Deletes custom menu settings and baseline files back to template values.</p>
                  <button 
                    onClick={() => {
                      if (confirm("Reset to factory presets?")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="btn btn-danger w-fit"
                  >
                    Wipe database cache
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ==================== MODAL: DAILY SHIFT INVENTORY SETUP ==================== */}
      {showStockSetup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl max-w-lg w-full border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col gap-6">
            <h2 className="text-xl font-bold dark:text-white">Initial Morning Stock check-in</h2>
            <p className="text-xs text-gray-400">Verify and enter raw ingredient weights for the day to establish order deductions.</p>
            <form onSubmit={handleStockSetupSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-1 p-1">
                {rawMaterials.map(mat => (
                  <div key={mat.id} className="form-group">
                    <label className="text-xs text-gray-500 font-semibold">{mat.name} ({mat.unit})</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-slate-100 dark:bg-gray-800 text-sm p-2 rounded-lg mt-1 outline-none border-none dark:text-white font-bold"
                      value={stockSetupValues[mat.id] !== undefined ? stockSetupValues[mat.id] : mat.quantity}
                      onChange={(e) => setStockSetupValues({ ...stockSetupValues, [mat.id]: e.target.value })}
                      required
                    />
                  </div>
                ))}
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all mt-2">
                Confirm stock & Open Register
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: EDIT SALES OVERRIDES ==================== */}
      {editingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl max-w-md w-full border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold dark:text-white">Edit order #{editingOrder.id}</h2>
              <button onClick={() => setEditingOrder(null)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEditSale} className="flex flex-col gap-4 text-sm">
              <div className="form-group">
                <label className="text-xs text-gray-500 font-semibold uppercase">Table Label</label>
                <input
                  type="text"
                  className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white"
                  value={editingOrder.table_label}
                  onChange={(e) => setEditingOrder({ ...editingOrder, table_label: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="text-xs text-gray-500 font-semibold uppercase">Items Array (JSON Format)</label>
                <textarea
                  className="w-full h-32 bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white font-mono text-[11px]"
                  value={editingOrder.itemsJson}
                  onChange={(e) => setEditingOrder({ ...editingOrder, itemsJson: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="text-xs text-gray-500 font-semibold uppercase">Payment Method</label>
                <select
                  className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white"
                  value={editingOrder.payment_method}
                  onChange={(e) => setEditingOrder({ ...editingOrder, payment_method: e.target.value })}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              <div className="form-group">
                <label className="text-xs text-gray-500 font-semibold uppercase">Employee Name</label>
                <input
                  type="text"
                  className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white"
                  value={editingOrder.employee_name || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, employee_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="text-xs text-gray-500 font-semibold uppercase">Notes / Comments</label>
                <textarea
                  className="w-full h-20 bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white text-xs"
                  value={editingOrder.notes || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                  placeholder="Add notes about this order..."
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all mt-2">
                Save Sale Override
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: STRIPE PAYOUT INVOICE SUCCESS RECEIPT ==================== */}
      {payoutSuccessData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl max-w-sm w-full border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col gap-4 text-center">
            <span className="text-5xl">💳</span>
            <h2 className="text-lg font-bold text-emerald-500">Stripe Payroll Complete</h2>
            <p className="text-xs text-gray-400">Salary transaction successfully routed through Stripe API element endpoints.</p>
            
            <div className="border rounded-xl p-4 text-left flex flex-col gap-2 bg-slate-50 dark:bg-gray-800 dark:border-gray-700 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Employee ID:</span><span className="font-bold dark:text-white">{payoutSuccessData.employeeId}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Transferred Amount:</span><span className="font-bold dark:text-white text-emerald-500">${parseFloat(payoutSuccessData.amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Stripe session id:</span><span className="font-bold truncate max-w-[180px] dark:text-white">{payoutSuccessData.sessionId}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Billing Date:</span><span className="font-bold dark:text-white">{payoutSuccessData.date}</span></div>
            </div>
            
            <button onClick={closePayoutModal} className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl hover:bg-emerald-700 transition-all mt-2">
              Done & Close
            </button>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD/EDIT EMPLOYEE ==================== */}
      {showEmpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl max-w-md w-full border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold dark:text-white">{editingEmp ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setShowEmpModal(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEmpSubmit} className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Name</label>
                  <input type="text" className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white" value={empFormData.name} onChange={(e) => setEmpFormData({...empFormData, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Role</label>
                  <select className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white" value={empFormData.role} onChange={(e) => setEmpFormData({...empFormData, role: e.target.value})}>
                    <option value="Chef">Chef</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Inventory Staff">Inventory Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Waiter">Waiter</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Hourly Rate ($)</label>
                  <input type="number" step="0.5" className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white" value={empFormData.hourlyRate} onChange={(e) => setEmpFormData({...empFormData, hourlyRate: parseFloat(e.target.value) || 0})} required />
                </div>
                <div className="form-group">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Shift</label>
                  <input type="text" className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white" value={empFormData.shift} onChange={(e) => setEmpFormData({...empFormData, shift: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Bank Name</label>
                  <input type="text" className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white" value={empFormData.bankName} onChange={(e) => setEmpFormData({...empFormData, bankName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Bank Account</label>
                  <input type="text" className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white" value={empFormData.bankAccount} onChange={(e) => setEmpFormData({...empFormData, bankAccount: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="text-xs text-gray-500 font-semibold uppercase">Salary Amount ($)</label>
                <input type="number" step="0.01" className="w-full bg-slate-100 dark:bg-gray-800 p-2.5 rounded-lg mt-1 outline-none border-none dark:text-white" value={empFormData.salaryAmount} onChange={(e) => setEmpFormData({...empFormData, salaryAmount: parseFloat(e.target.value) || 0})} required />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all mt-2">
                {editingEmp ? 'Update Employee' : 'Add Employee'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MOCK RECEIPT PRINTER POPUP ==================== */}
      {printedReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-none w-80 border-2 border-dashed border-gray-400 shadow-2xl flex flex-col gap-4 text-xs font-mono text-black">
            <div className="text-center font-bold text-lg uppercase tracking-widest border-b-2 border-dashed pb-2 border-gray-400">
              Steve OS Diner
            </div>
            <div className="flex flex-col gap-1">
              <div>Receipt ID: {printedReceipt.orderId}</div>
              <div>Date: {printedReceipt.date} • Time: {printedReceipt.time}</div>
              <div>Terminal: POS Counter Cashier</div>
            </div>
            <div className="border-t-2 border-dashed pt-2 border-gray-400 flex flex-col gap-2">
              {printedReceipt.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.quantity}x {it.name}</span>
                  <span>${(it.price * it.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t-2 border-dashed pt-2 border-gray-400 flex justify-between font-bold text-sm">
              <span>Total Payment:</span>
              <span>${printedReceipt.total.toFixed(2)}</span>
            </div>
            <div className="text-center font-bold mt-4 uppercase border-t-2 border-dashed pt-2 border-gray-400 tracking-wider">
              Thank you!
            </div>
            <button onClick={() => setPrintedReceipt(null)} className="w-full bg-black text-white py-2 font-semibold hover:bg-gray-800 transition-all mt-2">
              Print & Close
            </button>
          </div>
        </div>
      )}

      {/* ==================== ROLE SWITCHER MODAL ==================== */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl max-w-xs w-full border dark:border-gray-800 shadow-2xl flex flex-col gap-4">
            <h2 className="text-md font-bold dark:text-white border-b pb-2">Simulate login Workspace Profile</h2>
            <div className="flex flex-col gap-2">
              {['admin', 'manager', 'cashier', 'kitchen', 'inventory'].map(role => (
                <button
                  key={role}
                  onClick={() => {
                    setActiveRole(role);
                    setShowRoleModal(false);
                  }}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all uppercase ${
                    activeRole === role 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-slate-200'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
