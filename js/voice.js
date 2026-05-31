(function () {
  let isListening = false;
  let wakeWordDetected = false;
  let recognition = null;
  let synth = window.speechSynthesis;
  let voiceLogs = [];

  function cleanResponse(text) {
    return text.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*?\}/g, '').trim() || text.split('.')[0] + '.';
  }

  const toggleBtn = document.getElementById("steve-toggle-btn");
  const panel = document.getElementById("steve-panel");
  const statusEl = document.getElementById("steve-status");
  const transcriptEl = document.getElementById("steve-transcript");
  const responseEl = document.getElementById("steve-response");
  const logsContainer = document.getElementById("steve-logs-container");
  const wakeIndicator = document.getElementById("steve-wake-indicator");
  const textInput = document.getElementById("steve-text-input");

  function log(message, type) {
    voiceLogs.push({ message, type, time: new Date().toLocaleTimeString() });
    if (logsContainer) {
      const row = document.createElement("div");
      row.className = "steve-log-item";
      row.innerHTML = `<span class="steve-log-time">${new Date().toLocaleTimeString()}</span><span class="steve-log-msg ${type}">${escapeHtml(message)}</span>`;
      logsContainer.appendChild(row);
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }

  function speak(text, cb) {
    if (!synth) { if (cb) cb(); return; }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.05;
    utter.onend = () => { if (cb) cb(); };
    utter.onerror = () => { if (cb) cb(); };
    synth.speak(utter);
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function updateTranscript(text) {
    if (transcriptEl) transcriptEl.textContent = text;
  }

  function setResponse(text) {
    if (responseEl) responseEl.textContent = text;
  }

  function syncLocalDb(backendData) {
    if (!window.dbManager) return;
    const db = window.dbManager.get();

    if (!db.shiftActive && backendData.orders) {
      log('Shift must be active to sync orders.', 'error');
      return;
    }

    if (backendData.orders) {
      backendData.orders.forEach(bo => {
        const existing = db.orders.find(o => o.id === bo.id);
        if (!existing) db.orders.push(bo);
      });
    }
    if (backendData.attendance) {
      const today = new Date().toISOString().split('T')[0];
      db.attendance[today] = backendData.attendance;
    }
    if (backendData.rawMaterials) {
      backendData.rawMaterials.forEach(bm => {
        const existing = db.rawMaterials.find(m => m.id === bm.id);
        if (existing) existing.quantity = bm.quantity;
      });
    }
    if (backendData.salesHistory) {
      db.salesHistory = backendData.salesHistory;
    }
    if (backendData.menuItems) {
      backendData.menuItems.forEach(bi => {
        const existing = db.menuItems.find(m => m.id === bi.id);
        if (!existing) db.menuItems.push(bi);
      });
    }
    if (backendData.employees) {
      backendData.employees.forEach(be => {
        const existing = db.employees.find(e => e.id === be.id);
        if (!existing) db.employees.push(be);
      });
    }
    window.dbManager.save(db);
  }

  function refreshUI() {
    if (window.renderDashboard) window.renderDashboard();
    if (window.renderOrders) window.renderOrders();
    if (window.renderInventory) window.renderInventory();
    if (window.renderAttendance) window.renderAttendance();
    if (window.renderEmployees) window.renderEmployees();
    if (window.renderSalaries) window.renderSalaries();
    if (window.renderDbEditor) window.renderDbEditor();
    if (window.renderSuppliers) window.renderSuppliers();
    if (window.renderRawMaterials) window.renderRawMaterials();
    if (window.renderRecipes) window.renderRecipes();
    if (window.renderSessionLog) window.renderSessionLog();
  }

  async function processWithAI(text) {
    updateTranscript(text);
    log("You: " + text, "user");
    setStatus("Thinking...");
    setResponse("...");

    try {
      const resp = await fetch("/api/assistant/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await resp.json();

      if (data.success) {
        const msg = cleanResponse(data.response || "Done.");
        setResponse(msg);
        speak(msg);

          if (data.resultData) {
            // Show query results in response area
            if (data.resultData.orders) {
              setResponse(msg + " Found " + data.resultData.orders.length + " orders.");
              log("Orders data: " + JSON.stringify(data.resultData.orders.slice(0, 5)), "system");
            }
            if (data.resultData.employees) {
              setResponse(msg + " Found " + data.resultData.employees.length + " employees.");
              log("Employees: " + data.resultData.employees.map(e => e.name).join(", "), "system");
            }
            if (data.resultData.salesSummary) {
              const s = data.resultData.salesSummary;
              setResponse(msg + ` Today: $${s.todayRevenue.toFixed(2)} revenue, $${s.todayProfit.toFixed(2)} profit. ${s.activeOrders} active orders. Lifetime: $${s.totalRevenue.toFixed(2)}.`);
            }
            if (data.resultData.stockUpdated) {
              log("Stock updated for: " + data.resultData.stockUpdated, "system");
            }
            if (data.resultData.orderCreated) {
              log("Order created successfully via AI", "system");
            }
            if (data.resultData.lowStockWarnings) {
              data.resultData.lowStockWarnings.forEach(w => log("Low stock: " + w, "warning"));
            }
            if (data.resultData.navigate && window.navigateTo) {
              window.navigateTo(data.resultData.navigate);
              log("Navigated to: " + data.resultData.navigate, "system");
            }

            // Sync local DB with any data from backend
            syncLocalDb(data.resultData);
          }

        if (data.needsRefresh) {
          refreshUI();
        }

        log("Steve: " + msg, "response");
      } else {
        setResponse(data.error || "Something went wrong.");
        log("Error: " + (data.error || "Unknown"), "error");
      }
    } catch (err) {
      setResponse("Could not reach server.");
      log("Network error: " + err.message, "error");
    }

    setStatus("Type a command or tap mic");
  }

  function startListening() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setStatus("Speech not supported. Use the text input.");
      textInput.focus();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = function (event) {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      const currentText = (finalTranscript + interim).toLowerCase().trim();
      updateTranscript(currentText || "(listening...)");

      if (!wakeWordDetected) {
        if (currentText.includes("hey steve") || currentText.includes("steve")) {
          wakeWordDetected = true;
          if (wakeIndicator) wakeIndicator.classList.add("active");
          setStatus("Listening...");
          log("Wake word detected", "system");
          speak("Yes?", () => { finalTranscript = ""; });
        }
        return;
      }

      if (currentText.includes("stop listening") || currentText.includes("go to sleep")) {
        wakeWordDetected = false;
        if (wakeIndicator) wakeIndicator.classList.remove("active");
        setStatus("Sleeping — say 'Hey Steve'");
        log("Voice sleeping", "system");
        finalTranscript = "";
        return;
      }

      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const cmd = finalTranscript.replace(/hey steve|steve/gi, "").trim();
        if (cmd.length > 2) {
          processWithAI(cmd);
          wakeWordDetected = false;
          if (wakeIndicator) wakeIndicator.classList.remove("active");
          finalTranscript = "";
        }
      }
    };

    recognition.onerror = function (event) {
      if (event.error === "no-speech" || event.error === "aborted") return;
      log("Mic error: " + event.error, "error");
      setStatus("Mic error — type instead");
    };

    recognition.onend = function () {
      if (isListening) {
        try { recognition.start(); } catch (e) {}
      }
    };

    try {
      recognition.start();
      isListening = true;
      if (toggleBtn) toggleBtn.classList.add("listening");
      setStatus("Say 'Hey Steve' to wake me");
      log("Voice ready — say 'Hey Steve'", "system");
    } catch (e) {
      log("Mic failed: " + e.message, "error");
      setStatus("Mic unavailable — type instead");
    }
  }

  function stopListening() {
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
    isListening = false;
    wakeWordDetected = false;
    if (toggleBtn) toggleBtn.classList.remove("listening");
    if (wakeIndicator) wakeIndicator.classList.remove("active");
    setStatus("Voice off");
    log("Voice stopped", "system");
    synth.cancel();
  }

  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      panel.classList.remove("closed");
      panel.classList.remove("minimized");
      startListening();
    }
  }

  function sendTextCommand() {
    const text = textInput.value.trim();
    if (text) {
      processWithAI(text);
      textInput.value = "";
    }
  }

  window.toggleSteveListening = toggleListening;

  document.addEventListener("DOMContentLoaded", () => {
    if (toggleBtn) {
      toggleBtn.addEventListener("click", toggleListening);
    }

    const sendBtn = document.getElementById("steve-send-btn");
    if (sendBtn) {
      sendBtn.addEventListener("click", sendTextCommand);
    }

    if (textInput) {
      textInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendTextCommand();
      });
      setTimeout(() => textInput.focus(), 1000);
    }

    const header = document.querySelector(".steve-panel-header");
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    panel.style.right = "24px";
    panel.style.bottom = "96px";
    panel.style.top = "auto";
    panel.style.left = "auto";

    function startDrag(e, clientX, clientY) {
      if (e.target.closest(".steve-panel-actions")) return;
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffsetX = clientX - rect.left;
      dragOffsetY = clientY - rect.top;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.position = "fixed";
      panel.style.cursor = "grabbing";
    }

    header.addEventListener("mousedown", (e) => startDrag(e, e.clientX, e.clientY));
    header.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      startDrag(e, t.clientX, t.clientY);
    }, { passive: true });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      panel.style.left = (e.clientX - dragOffsetX) + "px";
      panel.style.top = (e.clientY - dragOffsetY) + "px";
    });
    document.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const t = e.touches[0];
      panel.style.left = (t.clientX - dragOffsetX) + "px";
      panel.style.top = (t.clientY - dragOffsetY) + "px";
    }, { passive: true });

    document.addEventListener("mouseup", () => { isDragging = false; panel.style.cursor = ""; });
    document.addEventListener("touchend", () => { isDragging = false; panel.style.cursor = ""; });

    const minimizeBtn = document.getElementById("steve-minimize-btn");
    if (minimizeBtn) {
      minimizeBtn.addEventListener("click", () => {
        panel.classList.toggle("minimized");
        minimizeBtn.textContent = panel.classList.contains("minimized") ? "+" : "−";
      });
    }

    const closeBtn = document.getElementById("steve-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        panel.classList.add("closed");
        if (isListening) stopListening();
      });
    }

    const launchBtn = document.getElementById("launch-voice-assistant-btn");
    if (launchBtn) {
      launchBtn.addEventListener("click", (e) => {
        e.preventDefault();
        panel.classList.remove("closed");
        panel.classList.remove("minimized");
        textInput.focus();
      });
    }

    setTimeout(() => {
      log("Steve AI ready — I have full database access. Try anything!", "system");
      setStatus("Type or speak naturally");
      setResponse("Hi! I'm Steve. I can read and modify your restaurant data. Try: 'order 2 pizzas for table 5', 'mark John present', 'what's low on stock?', 'show me sales'");
    }, 500);
  });
})();
