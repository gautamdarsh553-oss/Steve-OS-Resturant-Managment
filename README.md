# Steve OS — Restaurant Resource Management System

Full-stack restaurant management platform with POS, inventory tracking, employee management, payroll, attendance, analytics dashboard, and AI voice assistant.

## Tech Stack

- **Backend:** Node.js, Express, JWT, Stripe, Nodemailer
- **Frontend (Legacy):** HTML, CSS, JavaScript
- **Frontend (Modern):** Next.js 16, React 19, Tailwind CSS v4, Recharts
- **Database:** Supabase (PostgreSQL) or in-memory fallback
- **AI:** Groq API (Llama 3.3) for voice assistant
- **Voice Assistant:** Python (SpeechRecognition + pyttsx3)

## Features

- Point of Sale with cart management and order tracking
- Inventory management with low-stock AI alerts
- Employee roster with role-based access (admin, manager, cashier, kitchen, inventory)
- Payroll processing via Stripe with email OTP verification
- Attendance tracking with clock-in/clock-out
- Live analytics dashboard with revenue, profit, and trends
- AI voice assistant (Steve) for natural language commands
- Authentication with JWT and role-based authorization

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.14+ (for voice assistant, optional)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/gautamdarsh553-oss/Steve-OS-Resturant-Managment.git
cd Steve-OS-Resturant-Managment

# Set up environment variables
cp .env.example backend/.env
# Edit backend/.env and fill in your API keys (see Configuration section)

# Install and start backend
cd backend
npm install
npm start

# In a new terminal — install and start frontend
cd frontend
npm install
npm run dev
```

The legacy frontend is available at `http://localhost:8000` and the Next.js frontend at `http://localhost:3000`.

### Default Login
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| manager | admin123 | manager |
| cashier | admin123 | cashier |
| kitchen | admin123 | kitchen |
| inventory | admin123 | inventory |

## Configuration

Copy `.env.example` to `backend/.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 8000) |
| `JWT_SECRET` | Yes | Random string for token signing |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_KEY` | No | Supabase API key |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for payments |
| `GROQ_API_KEY` | No | Groq API key for AI voice assistant |
| `SMTP_USER` | No | Gmail address for OTP emails |
| `SMTP_PASS` | No | Gmail app password |
| `FRONTEND_URL` | No | Frontend URL for CORS |

The app runs with in-memory data if Supabase is not configured.

## Voice Assistant

The Python voice assistant is optional:
```bash
cd voice_assistant
pip install -r requirements.txt
python voice_gui.py
```

## Project Structure

```
├── backend/          # Express API server
├── frontend/         # Next.js modern frontend
├── js/               # Legacy frontend scripts
├── css/              # Legacy frontend styles
├── voice_assistant/  # Python AI voice assistant
├── index.html        # Legacy frontend entry
└── .env.example      # Environment template
```

## Deployment

- **Frontend:** Deploy `frontend/` on Vercel with `NEXT_PUBLIC_API_URL` pointing to backend
- **Backend:** Deploy `backend/` on Render as a Node.js web service
