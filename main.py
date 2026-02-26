import cv2
import time
import numpy as np
import pygetwindow as gw

from src.detector import detect_objects
from src.face_utils import detect_faces
from src.light_utils import is_face_dark
from src.person_utils import count_persons
from src.screen_utils import is_looking_at_screen
from src.logger import init_logger, log_event
from src.screenshot_utils import save_screenshot
from src.session_utils import create_session_id
from src.webcam import start_webcam

# ---------------- CONFIG ----------------
MAX_WARNINGS = 50
WARNING_COOLDOWN = 5

FACE_MISSING_THRESHOLD = 6        # seconds
LOW_LIGHT_THRESHOLD = 8           # seconds
GRACE_PERIOD = 30

# ---- Behavioral features ----
MAX_TAB_SWITCH_WARNINGS = 5
IDLE_TIME_THRESHOLD = 20          # seconds
MOTION_THRESHOLD = 5000
# ----------------------------------------

# Session setup
session_id = create_session_id()
print(f"[INFO] Session started: {session_id}")

log_file = init_logger(session_id)
session_start_time = time.time()
cap = start_webcam()

# State variables
warning_count = 0
last_warning_time = 0

face_missing_start = None
low_light_start = None

# Tab switch tracking
last_active_window = gw.getActiveWindowTitle()
tab_switch_count = 0

# Idle detection
last_motion_time = time.time()
prev_gray = None


def add_aggregated_warning(reasons, frame):
    global warning_count, last_warning_time

    # Grace period
    if time.time() - session_start_time < GRACE_PERIOD:
        return

    now = time.time()
    if now - last_warning_time >= WARNING_COOLDOWN:
        warning_count += 1
        last_warning_time = now

        reason_text = " | ".join(reasons)
        print(f"[WARNING {warning_count}] {reason_text}")

        log_event(log_file, "WARNING", reason_text, warning_count)
        save_screenshot(frame, session_id, reason_text)


while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = detect_objects(frame)
    annotated_frame = results[0].plot()
    violations = []

    # --------------------------------------------------
    # 📱 Mobile phone → instant disqualification
    # --------------------------------------------------
    for box in results[0].boxes:
        cls_id = int(box.cls[0])
        if results[0].names[cls_id] == "cell phone":
            log_event(log_file, "DISQUALIFIED", "Mobile phone detected", warning_count)
            save_screenshot(frame, session_id, "Mobile_phone_detected")

            cv2.putText(
                annotated_frame,
                "DISQUALIFIED: Mobile Phone Detected!",
                (40, 200),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.5,
                (0, 0, 255),
                4
            )
            cv2.imshow("AI Proctoring System", annotated_frame)
            cv2.waitKey(3000)
            cap.release()
            cv2.destroyAllWindows()
            exit()

    # --------------------------------------------------
    # 👤 Face detection (Haar)
    # --------------------------------------------------
    faces = detect_faces(frame)

    if len(faces) == 0:
        if face_missing_start is None:
            face_missing_start = time.time()
        elif time.time() - face_missing_start >= FACE_MISSING_THRESHOLD:
            violations.append("Face not visible")
    else:
        face_missing_start = None
        face = faces[0]
        h, w, _ = frame.shape

        # 👀 INSTANT head-turn / not-looking warning
        if not is_looking_at_screen(face, w, h):
            violations.append("Not looking at screen")

        # 🌑 Face-based low light
        if is_face_dark(frame, face):
            if low_light_start is None:
                low_light_start = time.time()
            elif time.time() - low_light_start >= LOW_LIGHT_THRESHOLD:
                violations.append("Low light (face region)")
        else:
            low_light_start = None

    # --------------------------------------------------
    # 👥 Multiple persons
    # --------------------------------------------------
    if count_persons(results) > 1:
        violations.append("Multiple persons detected")

    # --------------------------------------------------
    # 🖥️ Tab / window switch detection
    # --------------------------------------------------
    current_window = gw.getActiveWindowTitle()
    if current_window != last_active_window:
        tab_switch_count += 1
        last_active_window = current_window
        log_event(log_file, "INFO", "Window switch detected", tab_switch_count)

        if tab_switch_count >= MAX_TAB_SWITCH_WARNINGS:
            violations.append("Frequent tab/window switching")

    # --------------------------------------------------
    # 🧍 Idle / no-movement detection
    # --------------------------------------------------
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if prev_gray is not None:
        diff = cv2.absdiff(prev_gray, gray)
        motion_score = np.sum(diff)

        if motion_score > MOTION_THRESHOLD:
            last_motion_time = time.time()

    prev_gray = gray

    if time.time() - last_motion_time > IDLE_TIME_THRESHOLD:
        violations.append("User inactive / no movement")

    # --------------------------------------------------
    # ⚠️ Smart aggregated warning
    # --------------------------------------------------
    if violations:
        add_aggregated_warning(violations, frame)
        y = 80
        for v in violations:
            cv2.putText(
                annotated_frame,
                f"WARNING: {v}",
                (30, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 255),
                3
            )
            y += 40

    # --------------------------------------------------
    # ⏳ Grace period display
    # --------------------------------------------------
    elapsed = int(time.time() - session_start_time)
    if elapsed < GRACE_PERIOD:
        cv2.putText(
            annotated_frame,
            f"Grace Period: {GRACE_PERIOD - elapsed}s",
            (30, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            3
        )

    # --------------------------------------------------
    # 🔢 Warning counter
    # --------------------------------------------------
    cv2.putText(
        annotated_frame,
        f"Warnings: {warning_count}/{MAX_WARNINGS}",
        (30, 260),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 0, 255),
        3
    )

    if warning_count >= MAX_WARNINGS:
        log_event(log_file, "DISQUALIFIED", "Too many warnings", warning_count)
        save_screenshot(frame, session_id, "Too_many_warnings")
        break

    cv2.imshow("AI Proctoring System", annotated_frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
