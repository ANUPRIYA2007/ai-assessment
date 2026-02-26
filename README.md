# 🛡️ ProctorForge AI - Secure Assessment Platform

ProctorForge AI is a state-of-the-art, zero-trust remote assessment platform designed for educational institutions and corporate hiring. It features an AI-driven proctoring engine, real-time behavioral analytics, and high-performance dashboards for teachers and administrators.

---

## 🌟 Latest Updates & New Features
We've recently overhauled the platform with several critical enhancements:
- **📊 Real-Time Exam Reports**: Instant live statistics for active exams including student status, average scores, and gender breakdowns.
- **🏫 Enhanced Teacher Dashboard**: A completely rebuilt interface with live polling, live stat cards, and detailed exam row metadata.
- **👥 Direct Student Management**: Administrators can now add students directly to classes, bypassing manual registration for bulk onboarding.
- **📁 Class-Centric Architecture**: Teachers can now assign exams directly to Classes, Years, and Sections.
- **🎨 Premium UI Redesign**: Modern "Glassmorphism" design system with GSAP animations, role-based color themes, and responsive layouts.

---

## 🚀 Key Features

### 1. **AI-Powered Proctoring**
- **MediaPipe Integration**: Real-time head pose, gaze tracking, and object detection.
- **Browser Lockdown**: Enforced fullscreen mode, tab-switching detection, and clipboard blocking.
- **Typing Biometrics**: Analyzes keystroke patterns to detect identity theft or "ghostwriting."
- **Trust Score Engine**: A composite score (0-100) based on environmental and behavioral signals.

### 2. **Teacher Command Center**
- **Exam Builder**: Create complex MCQ tests and Coding assessments (Monaco IDE).
- **Live Monitoring**: Track every student's status (Submitted, In-Progress, Not Started) in real-time.
- **Malpractice Detection**: Automatic flagging of suspicious activity with forensic logs.
- **Automated Grading**: Instant results for MCQs and sandboxed execution for code.

### 3. **Administrator Portal**
- **Class Management**: Create and manage groups (Classes, Years, Sections).
- **Student Directory**: Full control over student accounts and status (Active/Banned).
- **System Metrics**: High-level overview of global activity, active tests, and user stats.
- **Quick Navigation**: Tab-based routing for rapid system administration.

---

## 🏗️ Technical Stack

- **Frontend**: [Next.js 14](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/), [GSAP](https://greensock.com/gsap/), [Zustand](https://github.com/pmndrs/zustand).
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12), [SQLAlchemy](https://www.sqlalchemy.org/).
- **AI/ML**: [MediaPipe](https://google.github.io/mediapipe/) (Computer Vision), Custom Heuristic Trust Engine.
- **Real-time**: WebSockets for live monitoring and session sync.
- **Database**: PostgreSQL (Supabase) with local SQLite fallback.

---

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js**: v18 or higher.
- **Python**: v3.12 or higher.
- **Git**: For version control.

### 1. Clone the Repository
```bash
git clone https://github.com/ANUPRIYA2007/ai-assessment.git
cd ai-assessment
```

### 2. Backend Setup
```bash
cd proctorforge/server
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
*Backend will be running at `http://localhost:8001`*

### 3. Frontend Setup
```bash
cd proctorforge/client
npm install
npm run dev
```
*Frontend will be running at `http://localhost:3000`*

---

## 🎓 User Roles
| Role | Capabilities |
| :--- | :--- |
| **Admin** | System architecture, Class management, Direct student onboarding, Health monitoring. |
| **Teacher** | MCQ/Coding test creation, Live Proctoring, Real-time reporting, Assignment management. |
| **Student** | Exam participation, AI security validation, Result tracking, Code submission. |

---

## 🛡️ Security Policies
- **No Clipboard**: Students cannot copy or paste within the exam environment.
- **Fullscreen Enforcement**: Testing automatically ends if fullscreen is exited.
- **Device Fingerprinting**: Prevents account sharing across multiple machines.
- **AI Gaze Check**: Detects if a student is looking away from the screen for prolonged periods.

---

© 2026 ProctorForge AI. Built for the future of secure digital education.