"""
Steve OS Voice Assistant — Tkinter GUI
Run: python voice_gui.py   OR   python assistant.py --gui

Requires: tkinter (built-in with Python), plus the usual voice_assistant deps.
"""

import threading
import time
import queue
import sys
import os

# Ensure parent directory is on path so we can import assistant
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

try:
    import tkinter as tk
    from tkinter import font as tkfont
    from tkinter import scrolledtext, ttk
    _HAS_TK = True
except ImportError:
    _HAS_TK = False


# ── Colour palette ──────────────────────────────────────────────────────────
BG_DARK     = "#0d1117"
BG_CARD     = "#161b22"
BG_INPUT    = "#21262d"
ACCENT      = "#238636"
ACCENT_GLOW = "#2ea043"
RED_ACCENT  = "#da3633"
YELLOW      = "#d29922"
TEXT_PRI    = "#f0f6fc"
TEXT_SEC    = "#8b949e"
TEXT_MUT    = "#484f58"
BORDER      = "#30363d"
PULSE_ON    = "#1f6feb"
PULSE_OFF   = "#21262d"


class VoiceAssistantGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Steve OS — Voice Assistant")
        self.root.geometry("700x750")
        self.root.resizable(True, True)
        self.root.configure(bg=BG_DARK)
        self.root.minsize(500, 600)

        # Message queue for thread-safe GUI updates
        self._q: queue.Queue = queue.Queue()

        # Assistant runs in a background thread
        self._assistant = None
        self._assistant_thread: threading.Thread | None = None
        self._mic_active = False
        self._pulse_job = None

        self._build_ui()
        self._start_assistant()
        self._poll_queue()

    # ── UI construction ──────────────────────────────────────────────────────

    def _build_ui(self):
        # ── Header bar ──────────────────────────────────────────────────
        header = tk.Frame(self.root, bg=BG_DARK, pady=0)
        header.pack(fill="x", padx=0, pady=0)

        logo_frame = tk.Frame(header, bg=BG_DARK)
        logo_frame.pack(side="left", padx=20, pady=14)
        tk.Label(logo_frame, text="✨", font=("Segoe UI Emoji", 22), bg=BG_DARK, fg=TEXT_PRI).pack(side="left")
        title_block = tk.Frame(logo_frame, bg=BG_DARK)
        title_block.pack(side="left", padx=8)
        tk.Label(title_block, text="Steve OS", font=("Segoe UI", 14, "bold"), bg=BG_DARK, fg=TEXT_PRI).pack(anchor="w")
        tk.Label(title_block, text="Voice Assistant", font=("Segoe UI", 9), bg=BG_DARK, fg=TEXT_SEC).pack(anchor="w")

        # Status pill on the right
        pill_frame = tk.Frame(header, bg=BG_DARK)
        pill_frame.pack(side="right", padx=20, pady=14)
        self._status_dot = tk.Label(pill_frame, text="●", font=("Segoe UI", 12), bg=BG_DARK, fg=YELLOW)
        self._status_dot.pack(side="left")
        self._status_label = tk.Label(pill_frame, text="Starting…", font=("Segoe UI", 9), bg=BG_DARK, fg=TEXT_SEC)
        self._status_label.pack(side="left", padx=4)

        # ── Separator ───────────────────────────────────────────────────
        tk.Frame(self.root, bg=BORDER, height=1).pack(fill="x")

        # ── Mic visualiser ──────────────────────────────────────────────
        mic_frame = tk.Frame(self.root, bg=BG_DARK, pady=20)
        mic_frame.pack(fill="x")

        self._mic_btn = tk.Button(
            mic_frame,
            text="🎙",
            font=("Segoe UI Emoji", 36),
            bg=BG_CARD,
            fg=TEXT_PRI,
            activebackground=ACCENT,
            activeforeground=TEXT_PRI,
            bd=0,
            relief="flat",
            cursor="hand2",
            command=self._toggle_mic,
            padx=16,
            pady=10,
        )
        self._mic_btn.pack()
        self._mic_ring = tk.Label(
            mic_frame,
            text="Click to start listening",
            font=("Segoe UI", 9),
            bg=BG_DARK,
            fg=TEXT_SEC,
        )
        self._mic_ring.pack(pady=4)

        # ── Transcript area (heard text) ─────────────────────────────────
        heard_frame = tk.Frame(self.root, bg=BG_CARD, padx=16, pady=12)
        heard_frame.pack(fill="x", padx=16, pady=(0, 6))

        tk.Label(
            heard_frame,
            text="YOU SAID",
            font=("Segoe UI", 8, "bold"),
            bg=BG_CARD,
            fg=TEXT_MUT,
        ).pack(anchor="w")

        self._heard_var = tk.StringVar(value="(waiting for voice input…)")
        tk.Label(
            heard_frame,
            textvariable=self._heard_var,
            font=("Segoe UI", 12),
            bg=BG_CARD,
            fg=PULSE_ON,
            wraplength=600,
            justify="left",
        ).pack(anchor="w", pady=(4, 0))

        # ── Response area (assistant text) ───────────────────────────────
        resp_frame = tk.Frame(self.root, bg=BG_CARD, padx=16, pady=12)
        resp_frame.pack(fill="x", padx=16, pady=(0, 10))

        tk.Label(
            resp_frame,
            text="STEVE",
            font=("Segoe UI", 8, "bold"),
            bg=BG_CARD,
            fg=TEXT_MUT,
        ).pack(anchor="w")

        self._response_var = tk.StringVar(value="Voice assistant starting up…")
        tk.Label(
            resp_frame,
            textvariable=self._response_var,
            font=("Segoe UI", 12),
            bg=BG_CARD,
            fg=ACCENT_GLOW,
            wraplength=600,
            justify="left",
        ).pack(anchor="w", pady=(4, 0))

        # ── Conversation log ─────────────────────────────────────────────
        log_outer = tk.Frame(self.root, bg=BORDER, bd=1)
        log_outer.pack(fill="both", expand=True, padx=16, pady=(0, 10))

        log_header = tk.Frame(log_outer, bg=BG_INPUT, pady=6, padx=12)
        log_header.pack(fill="x")
        tk.Label(log_header, text="Conversation Log", font=("Segoe UI", 9, "bold"), bg=BG_INPUT, fg=TEXT_SEC).pack(side="left")

        self._log = scrolledtext.ScrolledText(
            log_outer,
            bg=BG_INPUT,
            fg=TEXT_PRI,
            font=("Consolas", 9),
            bd=0,
            relief="flat",
            wrap="word",
            state="disabled",
            height=10,
        )
        self._log.pack(fill="both", expand=True, padx=0, pady=0)
        # Tag colours
        self._log.tag_config("you", foreground=PULSE_ON)
        self._log.tag_config("steve", foreground=ACCENT_GLOW)
        self._log.tag_config("sys", foreground=TEXT_MUT)
        self._log.tag_config("warn", foreground=YELLOW)
        self._log.tag_config("err", foreground=RED_ACCENT)

        # ── Manual text input ────────────────────────────────────────────
        input_frame = tk.Frame(self.root, bg=BG_DARK, pady=10, padx=16)
        input_frame.pack(fill="x")

        self._text_input = tk.Entry(
            input_frame,
            bg=BG_INPUT,
            fg=TEXT_PRI,
            insertbackground=TEXT_PRI,
            font=("Segoe UI", 11),
            bd=0,
            relief="flat",
        )
        self._text_input.pack(side="left", fill="x", expand=True, ipady=8, padx=(0, 8))
        self._text_input.bind("<Return>", self._on_text_submit)
        self._text_input.insert(0, "Type a command…")
        self._text_input.bind("<FocusIn>", self._clear_placeholder)
        self._text_input.bind("<FocusOut>", self._restore_placeholder)

        send_btn = tk.Button(
            input_frame,
            text="Send ➜",
            font=("Segoe UI", 10, "bold"),
            bg=ACCENT,
            fg=TEXT_PRI,
            activebackground=ACCENT_GLOW,
            activeforeground=TEXT_PRI,
            bd=0,
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
            command=self._on_text_submit,
        )
        send_btn.pack(side="right")

        # ── Quick action chips ───────────────────────────────────────────
        chips_frame = tk.Frame(self.root, bg=BG_DARK, pady=0, padx=16)
        chips_frame.pack(fill="x", pady=(0, 14))
        tk.Label(chips_frame, text="Quick actions:", font=("Segoe UI", 8), bg=BG_DARK, fg=TEXT_MUT).pack(side="left", padx=(0, 8))

        quick_cmds = [
            ("📊 Sales",    "sales"),
            ("📦 Low Stock","low stock"),
            ("🧑‍💼 Absent",  "who is absent today"),
            ("📋 Orders",   "today's orders"),
            ("❓ Help",     "help"),
        ]
        for label, cmd in quick_cmds:
            btn = tk.Button(
                chips_frame,
                text=label,
                font=("Segoe UI", 8),
                bg=BG_INPUT,
                fg=TEXT_SEC,
                activebackground=BG_CARD,
                activeforeground=TEXT_PRI,
                bd=0,
                relief="flat",
                cursor="hand2",
                padx=8,
                pady=4,
                command=lambda c=cmd: self._run_command_text(c),
            )
            btn.pack(side="left", padx=2)

    # ── Placeholder helpers ──────────────────────────────────────────────────

    def _clear_placeholder(self, event):
        if self._text_input.get() == "Type a command…":
            self._text_input.delete(0, "end")
            self._text_input.config(fg=TEXT_PRI)

    def _restore_placeholder(self, event):
        if not self._text_input.get():
            self._text_input.insert(0, "Type a command…")
            self._text_input.config(fg=TEXT_MUT)

    # ── Assistant lifecycle ──────────────────────────────────────────────────

    def _start_assistant(self):
        from assistant import SteveVoiceAssistant
        self._assistant = SteveVoiceAssistant(
            text_mode=True,  # GUI manages listening itself
            gui_callback=self._gui_callback,
        )
        self._set_status("Ready", ACCENT_GLOW)
        self._log_write("[Steve OS Voice Assistant started — GUI mode]\n", "sys")

    def _gui_callback(self, key: str, value: str):
        """Called from background thread — must use queue."""
        self._q.put((key, value))

    def _poll_queue(self):
        """Drain the queue and update GUI (runs on main thread via after)."""
        try:
            while True:
                key, value = self._q.get_nowait()
                if key == "heard":
                    self._heard_var.set(value)
                    self._log_write(f"You: {value}\n", "you")
                elif key == "response":
                    self._response_var.set(value)
                    self._log_write(f"Steve: {value}\n", "steve")
                elif key == "status":
                    self._set_status(value, ACCENT_GLOW)
        except queue.Empty:
            pass
        self.root.after(80, self._poll_queue)

    def _log_write(self, text: str, tag: str = "sys"):
        self._log.configure(state="normal")
        self._log.insert("end", text, tag)
        self._log.see("end")
        self._log.configure(state="disabled")

    def _set_status(self, text: str, color: str = TEXT_SEC):
        self._status_label.config(text=text)
        self._status_dot.config(fg=color)

    # ── Mic toggle ───────────────────────────────────────────────────────────

    def _toggle_mic(self):
        if self._mic_active:
            self._stop_listening()
        else:
            self._start_listening()

    def _start_listening(self):
        self._mic_active = True
        self._mic_btn.config(bg=PULSE_ON, fg=TEXT_PRI)
        self._mic_ring.config(text="🔴 Listening…", fg=RED_ACCENT)
        self._set_status("Listening…", PULSE_ON)
        self._pulse()
        # Run listening in a background thread
        t = threading.Thread(target=self._listen_thread, daemon=True)
        t.start()

    def _stop_listening(self):
        self._mic_active = False
        self._mic_btn.config(bg=BG_CARD, fg=TEXT_PRI)
        self._mic_ring.config(text="Click to start listening", fg=TEXT_SEC)
        self._set_status("Ready", ACCENT_GLOW)
        if self._pulse_job:
            self.root.after_cancel(self._pulse_job)
            self._pulse_job = None

    def _pulse(self):
        """Animate mic button border while listening."""
        if not self._mic_active:
            return
        current = self._mic_btn.cget("bg")
        next_color = PULSE_ON if current == BG_INPUT else BG_INPUT
        # Just subtly change the label colour
        self._pulse_job = self.root.after(500, self._pulse)

    def _listen_thread(self):
        """Background thread: capture one voice command and execute it."""
        try:
            import speech_recognition as sr
            recognizer = sr.Recognizer()
            mic = sr.Microphone()
            with mic as source:
                recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = recognizer.listen(source, timeout=8, phrase_time_limit=8)
            command = recognizer.recognize_google(audio).lower().strip()
            self._q.put(("heard", command))
            self._q.put(("status", "Processing…"))
            # Run the command via assistant
            if self._assistant:
                self._assistant.parse_and_execute(command)
        except Exception as e:
            self._q.put(("response", f"Could not hear anything. ({e})"))
        finally:
            # Re-enable mic button on main thread
            self.root.after(0, self._stop_listening)

    # ── Manual text input ────────────────────────────────────────────────────

    def _on_text_submit(self, event=None):
        raw = self._text_input.get().strip()
        if not raw or raw == "Type a command…":
            return
        self._text_input.delete(0, "end")
        self._run_command_text(raw)

    def _run_command_text(self, command: str):
        self._q.put(("heard", command))
        self._set_status("Processing…", YELLOW)
        t = threading.Thread(
            target=self._exec_thread, args=(command,), daemon=True
        )
        t.start()

    def _exec_thread(self, command: str):
        if self._assistant:
            self._assistant.parse_and_execute(command)
        self.root.after(0, lambda: self._set_status("Ready", ACCENT_GLOW))

    # ── Window close ─────────────────────────────────────────────────────────

    def on_close(self):
        if self._assistant:
            self._assistant.running = False
        self.root.destroy()


# ---------------------------------------------------------------------------
# Launch
# ---------------------------------------------------------------------------
def launch_gui():
    if not _HAS_TK:
        print("[ERROR] tkinter is not available. Install Python with Tk support.")
        return

    root = tk.Tk()
    # Set dark title bar on Windows 11
    try:
        root.tk.call("source", "azure.tcl")
    except Exception:
        pass
    try:
        from ctypes import windll
        windll.dwmapi.DwmSetWindowAttribute(
            windll.user32.GetForegroundWindow(), 20,
            __import__("ctypes").byref(__import__("ctypes").c_int(1)),
            __import__("ctypes").sizeof(__import__("ctypes").c_int(1))
        )
    except Exception:
        pass

    app = VoiceAssistantGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.on_close)
    root.mainloop()


if __name__ == "__main__":
    launch_gui()
