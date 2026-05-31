"""
Steve OS Voice Assistant — Enhanced Python standalone version.

Features:
  - Voice / text input with Google Speech Recognition
  - Text-to-Speech responses via pyttsx3
  - Fuzzy employee name matching (difflib — no extra deps)
  - Place orders by voice with confirmation step:
      "order 2 burgers for table 5"  →  confirm/cancel
  - Mark employees present OR absent
  - Query today's open orders, absent staff, stock, sales, low stock

Run:
  python assistant.py              (voice + text mode)
  python assistant.py --text       (text-only, no mic needed)
  python assistant.py -c "sales"   (single command, exits after)
  python assistant.py --gui        (launch Tkinter GUI — see voice_gui.py)

Dependencies:
  pip install -r voice_assistant/requirements.txt
"""

import re
import sys
import time
import json
import difflib
import requests
import threading
import os
import os.path as osp
from datetime import datetime

API_BASE = "http://localhost:8000"

# ---------------------------------------------------------------------------
# Optional imports — degrade gracefully if a library is missing
# ---------------------------------------------------------------------------
try:
    import speech_recognition as sr
    _HAS_SPEECH = True
except ImportError:
    sr = None
    _HAS_SPEECH = False

try:
    import pyttsx3
    _HAS_TTS = True
except ImportError:
    pyttsx3 = None
    _HAS_TTS = False

try:
    import pyaudio
    _HAS_PYAUDIO = True
except ImportError:
    pyaudio = None
    _HAS_PYAUDIO = False


def _check_dependencies():
    missing = []
    if not _HAS_SPEECH:
        missing.append("SpeechRecognition")
    if not _HAS_TTS:
        missing.append("pyttsx3")
    if not _HAS_PYAUDIO:
        missing.append("pyaudio  (microphone input)")
    if missing:
        print("\n[WARNING] Missing optional dependencies:")
        for m in missing:
            print(f"  - {m}")
        print("Run: pip install -r voice_assistant/requirements.txt\n")


# ---------------------------------------------------------------------------
# Fuzzy name matching helper
# ---------------------------------------------------------------------------
def _fuzzy_find_employee(name_query: str, employees: list) -> dict | None:
    """
    Find the best matching employee for a spoken name.
    Uses difflib for fuzzy matching — no extra libraries needed.
    Returns the employee dict or None.
    """
    name_query = name_query.strip().lower()
    if not employees:
        return None

    # Exact match first (case-insensitive)
    for emp in employees:
        if emp.get("name", "").lower() == name_query:
            return emp

    # Partial containment check
    for emp in employees:
        if name_query in emp.get("name", "").lower():
            return emp

    # Fuzzy ratio match — threshold 0.6
    emp_names = [emp.get("name", "") for emp in employees]
    matches = difflib.get_close_matches(
        name_query, [n.lower() for n in emp_names], n=1, cutoff=0.55
    )
    if matches:
        matched_lower = matches[0]
        for emp in employees:
            if emp.get("name", "").lower() == matched_lower:
                return emp

    return None


# ---------------------------------------------------------------------------
# Number word → digit conversion
# ---------------------------------------------------------------------------
_NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "a": 1, "an": 1, "couple": 2, "few": 3,
}

def _parse_number(text: str) -> int | None:
    """Parse a number from text — handles digits and word forms."""
    text = text.strip().lower()
    if text.isdigit():
        return int(text)
    return _NUMBER_WORDS.get(text)


# ---------------------------------------------------------------------------
# Core Assistant
# ---------------------------------------------------------------------------
class SteveVoiceAssistant:

    def __init__(self, text_mode=False, gui_callback=None):
        """
        gui_callback: optional callable(heard_text, response_text) for GUI updates.
        """
        self.text_mode = text_mode or not (_HAS_SPEECH and _HAS_PYAUDIO)
        self.recognizer = None
        self.microphone = None
        self.tts_engine = None
        self.running = True
        self.gui_callback = gui_callback  # for Tkinter GUI integration

        # Pending order awaiting confirm/cancel
        self._pending_order: dict | None = None

        if not self.text_mode:
            try:
                self.recognizer = sr.Recognizer()
                self.microphone = sr.Microphone()
                self._calibrate_mic()
            except Exception:
                print("[INFO] Microphone not available — falling back to text mode.")
                self.text_mode = True

        if _HAS_TTS:
            try:
                self.tts_engine = pyttsx3.init()
                self.tts_engine.setProperty("rate", 170)
                self.tts_engine.setProperty("volume", 1.0)
                # Try to pick a clearer voice
                voices = self.tts_engine.getProperty("voices")
                if voices:
                    # Prefer English voice
                    en_voice = next(
                        (v for v in voices if "en" in v.id.lower()), voices[0]
                    )
                    self.tts_engine.setProperty("voice", en_voice.id)
            except Exception:
                self.tts_engine = None

    # ── helpers ────────────────────────────────────────────────────────────

    def _calibrate_mic(self):
        print("Calibrating microphone for ambient noise …")
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=1)
        print("Microphone ready.\n")

    def speak(self, text: str, gui_key: str = "response"):
        """Print + TTS speak. Notifies GUI callback if set."""
        print(f"[Steve] {text}")
        if self.gui_callback:
            self.gui_callback(gui_key, text)
        if self.tts_engine:
            try:
                self.tts_engine.say(text)
                self.tts_engine.runAndWait()
            except Exception:
                pass

    def listen(self) -> str:
        """Try microphone first; fall back to keyboard input."""
        if not self.text_mode and self.recognizer and self.microphone:
            print("[Listening …]")
            try:
                with self.microphone as source:
                    audio = self.recognizer.listen(
                        source, timeout=6, phrase_time_limit=7
                    )
                command = self.recognizer.recognize_google(audio).lower().strip()
                print(f"[You] {command}")
                if self.gui_callback:
                    self.gui_callback("heard", command)
                return command
            except sr.WaitTimeoutError:
                return ""
            except sr.UnknownValueError:
                return ""
            except sr.RequestError as e:
                print(f"[ERROR] Speech recognition service error: {e}")
                return ""
            except Exception as e:
                print(f"[ERROR] Mic error: {e} — switching to text mode.")
                self.text_mode = True

        # Text fallback
        try:
            raw = input("> ").strip().lower()
            if self.gui_callback:
                self.gui_callback("heard", raw)
            return raw
        except (EOFError, KeyboardInterrupt):
            return "quit"
        except Exception:
            return "quit"

    # ── command routing ────────────────────────────────────────────────────

    def parse_and_execute(self, command: str):
        """Route a command string to the appropriate handler."""
        if not command:
            return

        # ── Confirmation / cancellation for pending orders ──────────────
        if self._pending_order:
            if re.search(r"\b(confirm|yes|ok|place|go|do it)\b", command, re.I):
                self._confirm_pending_order()
            elif re.search(r"\b(cancel|no|abort|stop|never)\b", command, re.I):
                self._pending_order = None
                self.speak("Order cancelled. Nothing was placed.")
            else:
                self.speak(
                    "I have a pending order. Say 'confirm' to place it, or 'cancel' to discard it."
                )
            return

        # ── Help ────────────────────────────────────────────────────────
        if re.search(r"\b(help|commands|\?)\b", command, re.I):
            self._show_help()
            return

        # ── Command dispatch table ────────────────────────────────────
        cmd_map = [
            # attendance — mark present
            (
                r"mark\s+(.+?)\s+(?:as\s+)?(present|here|in|arrived|clocked?\s*in)",
                self._handle_mark_present,
            ),
            # attendance — mark absent
            (
                r"mark\s+(.+?)\s+(?:as\s+)?(absent|not\s+(?:here|in)|missing|off)",
                self._handle_mark_absent,
            ),
            # attendance — generic (present/absent/late)
            (
                r"mark\s+(.+?)\s+(?:as\s+)?(present|absent|late)",
                self._handle_attendance_generic,
            ),
            # order completion
            (
                r"(?:complete|done|finish|close)\s+(?:order\s+)?(?:for\s+)?(?:table\s*)?([\w\d]+|takeaway)",
                self._handle_complete_order,
            ),
            # place order — "order 2 burgers for table 5"
            (
                r"(?:order|place|add|get|want|bring)\s+(.+?)\s+(?:for\s+)?(?:table\s*)?([\w\d]+|takeaway)",
                self._handle_voice_order,
            ),
            # today's orders / open orders
            (
                r"(?:today['\u2019]?s?\s+orders?|open\s+orders?|how\s+many\s+orders?|list\s+orders?)",
                self._handle_todays_orders,
            ),
            # absent staff / who is absent
            (
                r"(?:who(?:'s|\s+is|\s+are)?\s+(?:absent|not\s+(?:here|in|coming))|absent\s+(?:staff|employees?))",
                self._handle_absent_staff,
            ),
            # attendance report
            (
                r"(?:attendance|who\s+(?:is\s+)?(?:here|present)|staff\s+today)",
                self._handle_attendance_report,
            ),
            # stock check
            (
                r"(?:how\s+(?:many|much)|check\s+stock(?:\s+of)?|stock\s+of|do\s+we\s+have)\s+(.+)",
                self._handle_stock_check,
            ),
            # sales / profit
            (r"(?:sales|profit|revenue|earnings|income)", self._handle_sales_query),
            # low stock
            (r"(?:low\s+stock|shortage|alerts?|running\s+low)", self._handle_low_stock),
            # cancel order item — kept simple
            (
                r"(?:cancel|remove|delete|void)\s+(?:order\s+)?(.+)",
                self._handle_cancel_order,
            ),
        ]

        for pattern, handler in cmd_map:
            m = re.search(pattern, command, re.I)
            if m:
                handler(command, m)
                return

        self.speak(
            f"I didn't understand '{command}'. Say 'help' to see available commands."
        )

    def _show_help(self):
        self.speak("Here are the available commands:")
        lines = [
            "",
            "  ORDERS",
            "    order [qty] [item] for table [n]   — Place a new order (asks to confirm)",
            "    complete table [n]                  — Mark an order as done",
            "    today's orders                      — List today's open orders",
            "",
            "  ATTENDANCE",
            "    mark [name] present                 — Clock employee in",
            "    mark [name] absent                  — Record employee as absent",
            "    who is absent today                 — List absent staff",
            "    attendance / who is here            — Today's attendance report",
            "",
            "  STOCK & SALES",
            "    check stock of [item]               — Check ingredient quantity",
            "    sales / profit / revenue            — Today's sales summary",
            "    low stock / alerts                  — Items running low",
            "",
            "  SYSTEM",
            "    help / commands / ?                 — Show this help",
            "    quit / exit / bye                   — Exit assistant",
            "",
        ]
        print("\n".join(lines))

    # ── API helpers ────────────────────────────────────────────────────────

    def _api_get(self, endpoint, params=None):
        try:
            r = requests.get(f"{API_BASE}{endpoint}", params=params, timeout=6)
            if r.ok:
                return r.json()
            print(f"[API] {endpoint} returned {r.status_code}: {r.text[:120]}")
            return None
        except requests.ConnectionError:
            self.speak(
                "Cannot reach the server. Make sure the backend is running on port 8000."
            )
            return None
        except Exception as e:
            print(f"[API ERROR] {e}")
            return None

    def _api_post(self, endpoint, data=None):
        try:
            r = requests.post(f"{API_BASE}{endpoint}", json=data, timeout=6)
            if r.ok:
                return r.json()
            err = r.json().get("error", r.text[:120]) if r.content else r.text
            self.speak(f"Server error: {err}")
            return None
        except requests.ConnectionError:
            self.speak("Cannot reach the server.")
            return None
        except Exception as e:
            print(f"[API ERROR] {e}")
            return None

    def _api_put(self, endpoint, data=None):
        try:
            r = requests.put(f"{API_BASE}{endpoint}", json=data, timeout=6)
            if r.ok:
                return r.json()
            err = r.json().get("error", r.text[:120]) if r.content else r.text
            self.speak(f"Server error: {err}")
            return None
        except requests.ConnectionError:
            self.speak("Cannot reach the server.")
            return None
        except Exception as e:
            print(f"[API ERROR] {e}")
            return None

    # ── Attendance handlers ────────────────────────────────────────────────

    def _resolve_employee(self, name_query: str):
        """Fetch employee list and fuzzy-match the given name."""
        employees = self._api_get("/api/employees")
        if employees is None:
            return None, None
        emp = _fuzzy_find_employee(name_query, employees)
        return emp, employees

    def _handle_mark_present(self, command, match):
        name = match.group(1).strip()
        emp, _ = self._resolve_employee(name)
        if not emp:
            self.speak(
                f"I couldn't find an employee matching '{name}'. "
                "Please check the name and try again."
            )
            return
        result = self._api_post("/api/attendance/clockin", {"employeeId": emp["id"]})
        if result:
            self.speak(f"Got it. {emp['name']} is marked present and clocked in.")
        else:
            self.speak(f"Failed to mark {emp['name']} as present. Server may have returned an error.")

    def _handle_mark_absent(self, command, match):
        name = match.group(1).strip()
        emp, _ = self._resolve_employee(name)
        if not emp:
            self.speak(
                f"I couldn't find an employee matching '{name}'."
            )
            return
        # Record absent via attendance endpoint with status absent
        result = self._api_post(
            "/api/attendance/clockin",
            {"employeeId": emp["id"], "status": "absent"}
        )
        if result:
            self.speak(f"Noted. {emp['name']} is marked absent for today.")
        else:
            # Fallback — try to log to console at least
            self.speak(f"Could not log to server, but noted: {emp['name']} is absent today.")

    def _handle_attendance_generic(self, command, match):
        """Fallback handler for 'mark [name] present/absent/late'."""
        name = match.group(1).strip()
        status = match.group(2).lower()
        emp, _ = self._resolve_employee(name)
        if not emp:
            self.speak(f"Employee '{name}' not found.")
            return
        if "absent" in status:
            result = self._api_post(
                "/api/attendance/clockin",
                {"employeeId": emp["id"], "status": "absent"}
            )
            if result:
                self.speak(f"{emp['name']} marked as absent.")
        else:
            result = self._api_post("/api/attendance/clockin", {"employeeId": emp["id"]})
            if result:
                self.speak(f"{emp['name']} marked as {status}.")

    def _handle_attendance_report(self, command, match):
        """Read out today's attendance — who is present."""
        attendance = self._api_get("/api/attendance")
        employees = self._api_get("/api/employees")
        if attendance is None or employees is None:
            return

        emp_map = {e["id"]: e["name"] for e in employees}
        present = [
            emp_map.get(a["employee_id"], a["employee_id"])
            for a in attendance
            if a.get("status") == "present"
        ]

        if not present:
            self.speak("No attendance records found for today.")
        else:
            names = ", ".join(present)
            self.speak(
                f"Today {len(present)} employee{'s are' if len(present) > 1 else ' is'} present: {names}."
            )

    def _handle_absent_staff(self, command, match):
        """Tell the manager who is absent today."""
        attendance = self._api_get("/api/attendance")
        employees = self._api_get("/api/employees")
        if attendance is None or employees is None:
            return

        present_ids = {
            a["employee_id"]
            for a in attendance
            if a.get("status") == "present"
        }
        absent = [
            e["name"]
            for e in employees
            if e["id"] not in present_ids
        ]

        if not absent:
            self.speak("Great news — all staff have clocked in today!")
        else:
            names = ", ".join(absent)
            self.speak(
                f"{len(absent)} staff member{'s have' if len(absent) > 1 else ' has'} "
                f"not clocked in yet: {names}."
            )

    # ── Order handlers ─────────────────────────────────────────────────────

    def _handle_voice_order(self, command: str, match):
        """
        Parse 'order 2 burgers for table 5' and ask for confirmation.
        Pattern group(1) = 'qty item', group(2) = 'table label'.
        """
        qty_item_raw = match.group(1).strip()
        table_raw = match.group(2).strip() if match.lastindex >= 2 else "Takeaway"

        # Resolve table label
        table_label = (
            "Takeaway"
            if re.search(r"takeaway|take\s*away|to\s*go", table_raw, re.I)
            else f"Table {table_raw.title()}"
        )

        # Parse quantity + item name from qty_item_raw
        # Format: "[number] [item name]"
        parts = qty_item_raw.split(None, 1)
        qty = _parse_number(parts[0]) if parts else None
        if qty is None:
            qty = 1
            item_name = qty_item_raw
        else:
            item_name = parts[1].strip() if len(parts) > 1 else ""

        if not item_name:
            self.speak(
                "I didn't catch the item name. Try: 'order 2 burgers for table 3'."
            )
            return

        # Look up menu item
        menu = self._api_get("/api/menu")
        if menu is None:
            return

        # Fuzzy match menu item
        item_names_lower = [m.get("name", "").lower() for m in menu]
        close = difflib.get_close_matches(
            item_name.lower(), item_names_lower, n=1, cutoff=0.45
        )
        if not close:
            self.speak(
                f"I couldn't find '{item_name}' on the menu. "
                "Check the item name and try again."
            )
            return

        matched_item = menu[item_names_lower.index(close[0])]
        total = round(matched_item.get("price", 0) * qty, 2)

        # Store pending order for confirmation
        self._pending_order = {
            "table_label": table_label,
            "item": matched_item,
            "qty": qty,
            "total": total,
        }

        self.speak(
            f"I'm about to place: {qty} × {matched_item['name']} for {table_label}. "
            f"Total: ${total:.2f}. "
            f"Say 'confirm' to place the order, or 'cancel' to discard."
        )

    def _confirm_pending_order(self):
        """Actually send the pending order to the API."""
        if not self._pending_order:
            return

        po = self._pending_order
        self._pending_order = None

        order_payload = {
            "table": po["table_label"],
            "items": [
                {
                    "itemId": po["item"]["id"],
                    "name": po["item"]["name"],
                    "quantity": po["qty"],
                    "price": po["item"].get("price", 0),
                }
            ],
            "total": po["total"],
            "order_source": "Voice",
            "payment_method": "Cash",
            "employee_name": "Voice Assistant",
        }

        result = self._api_post("/api/orders", order_payload)
        if result:
            self.speak(
                f"Order placed! {po['qty']} × {po['item']['name']} for "
                f"{po['table_label']}. Order ID: {result.get('id', 'N/A')}."
            )
        else:
            self.speak("Failed to place the order. Please try again or use the web interface.")

    def _handle_complete_order(self, command: str, match):
        target = match.group(1).strip().lower()
        orders = self._api_get("/api/orders")
        if orders is None:
            return

        # Find an active order for the table
        order = next(
            (
                o
                for o in orders
                if str(o.get("table_label", "")).lower().find(target) >= 0
                and o.get("status") not in ("completed", "refunded")
            ),
            None,
        )
        if order:
            result = self._api_put(
                f"/api/orders/{order['id']}", {"status": "completed"}
            )
            if result:
                self.speak(f"Order for table {target.title()} is now marked as completed.")
            else:
                self.speak("Failed to update the order status.")
        else:
            self.speak(
                f"No active order found for table {target.title()}. "
                "It may already be completed."
            )

    def _handle_todays_orders(self, command, match):
        """Read a summary of today's open orders."""
        orders = self._api_get("/api/orders")
        if orders is None:
            return

        today = datetime.now().strftime("%Y-%m-%d")
        today_orders = [
            o for o in orders if o.get("date") == today
        ]
        open_orders = [o for o in today_orders if o.get("status") == "pending"]
        completed = [o for o in today_orders if o.get("status") == "completed"]

        msg = (
            f"Today you have {len(today_orders)} order{'s' if len(today_orders) != 1 else ''} total. "
            f"{len(open_orders)} pending, {len(completed)} completed."
        )
        if open_orders:
            tables = [o.get("table_label", "unknown") for o in open_orders[:5]]
            msg += f" Pending tables: {', '.join(tables)}."
        self.speak(msg)

    # ── Stock / Sales handlers ─────────────────────────────────────────────

    def _handle_stock_check(self, command, match):
        query = match.group(1).strip()
        inventory = self._api_get("/api/inventory")
        if inventory is None:
            return

        inv_names = [m.get("name", "").lower() for m in inventory]
        # First try exact word containment
        found = None
        for word in query.lower().split():
            for mat in inventory:
                if word in mat.get("name", "").lower():
                    found = mat
                    break
            if found:
                break

        # Fallback: fuzzy match on full query
        if not found:
            close = difflib.get_close_matches(
                query.lower(), inv_names, n=1, cutoff=0.5
            )
            if close:
                found = inventory[inv_names.index(close[0])]

        if found:
            qty = found.get("quantity", 0)
            unit = found.get("unit", "units")
            name = found.get("name", "item")
            self.speak(
                f"We have {qty} {unit} of {name} remaining."
            )
        else:
            self.speak(
                f"I couldn't find '{query}' in the inventory. "
                "Try a more specific ingredient name."
            )

    def _handle_sales_query(self, command=None, match=None):
        summary = self._api_get("/api/analytics/summary")
        if summary:
            today_rev = summary.get("todayRevenue", 0)
            today_profit = summary.get("todayProfit", 0)
            today_orders = summary.get("todayOrderCount", 0)
            self.speak(
                f"Today's sales: ${today_rev:.2f} revenue, "
                f"${today_profit:.2f} profit, "
                f"from {today_orders} order{'s' if today_orders != 1 else ''}."
            )
        else:
            self.speak("Couldn't retrieve sales data.")

    def _handle_low_stock(self, command=None, match=None):
        alerts = self._api_get("/api/inventory/alerts")
        if not alerts:
            self.speak("All stock levels are healthy.")
            return
        if len(alerts) == 0:
            self.speak("No low stock alerts. Everything looks good.")
        else:
            items = [a.get("message", "").split(".")[0] for a in alerts[:4]]
            self.speak(
                f"Low stock warning! {len(alerts)} item{'s are' if len(alerts) > 1 else ' is'} "
                f"running low: {'; '.join(items)}."
            )

    def _handle_cancel_order(self, command, match):
        self.speak(
            "To cancel an order, please use the web dashboard. "
            "Navigate to Orders and click the cancel button."
        )

    # ── Main loop ──────────────────────────────────────────────────────────

    def run_interactive(self):
        mode = "[Mic] Voice + Text" if not self.text_mode else "[Kbd] Text only"
        print("=" * 60)
        self.speak("Steve OS Voice Assistant ready!")
        print(f"  Mode    : {mode}")
        print(f"  Server  : {API_BASE}")
        print(f"  Started : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        print("Type 'help' for commands, 'quit' to exit.\n")

        try:
            while self.running:
                command = self.listen()
                if not command:
                    continue
                if command in ("quit", "exit", "bye", "goodbye"):
                    self.speak("Goodbye! Have a great service!")
                    self.running = False
                    break
                self.parse_and_execute(command)
        except KeyboardInterrupt:
            print("\n[Interrupted] Exiting…")
            self.running = False

    def run_once(self, command_text: str):
        """Run a single command and exit — used for scripting."""
        self.parse_and_execute(command_text)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main():
    import argparse

    parser = argparse.ArgumentParser(description="Steve OS Voice Assistant")
    parser.add_argument("--command", "-c", help="Run a single command and exit")
    parser.add_argument(
        "--text", action="store_true", help="Force text-only mode (no microphone)"
    )
    parser.add_argument(
        "--gui", action="store_true", help="Launch the Tkinter GUI window"
    )
    args = parser.parse_args()

    _check_dependencies()

    if args.gui:
        # Import and launch the GUI module
        try:
            from voice_gui import launch_gui
            launch_gui()
        except ImportError:
            print("[ERROR] voice_gui.py not found. Run from the voice_assistant directory.")
        return

    assistant = SteveVoiceAssistant(text_mode=args.text or bool(args.command))

    if args.command:
        assistant.run_once(args.command)
    else:
        assistant.run_interactive()


if __name__ == "__main__":
    main()
