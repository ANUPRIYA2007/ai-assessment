# 🛡️ ProctorForge AI
### Production-Grade Remote Assessment Platform

ProctorForge AI is a zero-trust environment designed for secure MCQ and Coding assessments. It leverages AI identity verification and behavioral monitoring to ensure exam integrity.

---

## 🚀 Key Modules

### 📝 MCQ Assessment Engine
- **Dynamic Question Builder**: Custom options, marks, and categories.
- **Section/Class Mapping**: Assign tests directly to specific classes or years.
- **Instant Result Calculation**: Automatic grading with instant report generation.

### 💻 Real-Time Coding IDE
- **Monaco Editor**: VS Code-like experience for students.
- **Sandboxed Execution**: Isolated code execution for security.
- **Auto-Save**: Keystroke-level persistence to prevent data loss.

### 📊 Real-Time Command Center
- **Live Reporting**: Track student progress (In-Progress, Submitted, Malpractice).
- **Metric Cards**: Real-time stats for Teachers and Administrators.
- **Trust Heatmap**: Visual representation of system-wide integrity.

---

## 🏗️ Technical Architecture

| Layer | Technology |
| :--- | :--- |
| **Logic** | Next.js 14 (App Router) |
| **Styling** | Vanilla CSS + Tailwind CSS (Glassmorphism) |
| **Logic** | Python 3.12 (FastAPI) |
| **State** | Zustand (Auth & Global State) |
| **Animations** | GSAP (Smooth UI transitions) |

---

## ⚙️ Role-Based Access

### **Admin Portal**
- **Overview**: Real-time metrics of users and tests.
- **Classes**: Manage academic groups (Year, Section).
- **Students**: Direct account creation and class assignment.
- **Audit**: View global test logs and system health.

### **Teacher Portal**
- **Dashboard**: Live feed of active and recent tests.
- **Creation**: Specialized forms for MCQ and Coding tests.
- **Reporting**: Deep-dive analytics for specific exam IDs.

---

## 🛠️ Run the Development Environment

1. Ensure the **FastAPI** backend is running at `localhost:8001`.
2. Ensure the **Next.js** frontend is running at `localhost:3000`.
3. Login using your assigned role credentials.

---
*Empowering secure education with AI-driven integrity.*
