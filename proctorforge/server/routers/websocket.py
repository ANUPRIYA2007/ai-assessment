"""
ProctorForge AI - WebSocket Router
Real-time communication for live updates, violation events, and trust scores.
Uses Redis Pub/Sub for cross-client broadcasting.
"""
import json
import asyncio
from typing import Dict, Set
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from middleware.auth import decode_access_token

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Manages WebSocket connections by channel."""

    def __init__(self):
        # channel -> set of WebSocket connections
        self.channels: Dict[str, Set[WebSocket]] = {}
        # websocket -> user info
        self.user_map: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, channel: str, user_info: dict):
        await websocket.accept()
        if channel not in self.channels:
            self.channels[channel] = set()
        self.channels[channel].add(websocket)
        self.user_map[websocket] = user_info

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.channels:
            self.channels[channel].discard(websocket)
            if not self.channels[channel]:
                del self.channels[channel]
        self.user_map.pop(websocket, None)

    async def send_to_channel(self, channel: str, message: dict):
        """Broadcast message to all connections on a channel."""
        if channel in self.channels:
            dead = []
            for ws in self.channels[channel]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.channels[channel].discard(ws)

    async def send_to_user(self, websocket: WebSocket, message: dict):
        """Send message to a specific user."""
        try:
            await websocket.send_json(message)
        except Exception:
            pass

    def get_active_sessions(self) -> list:
        """Get all active user sessions."""
        return [
            {**info, "channel": ch}
            for ch, sockets in self.channels.items()
            for ws in sockets
            if (info := self.user_map.get(ws))
        ]


manager = ConnectionManager()


@router.websocket("/ws/{session_type}/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_type: str,  # "exam", "teacher", "admin"
    session_id: str,
):
    """
    WebSocket endpoint for real-time communication.

    Session types:
    - exam/{attempt_id}: Student exam session
    - teacher/{exam_id}: Teacher monitoring dashboard 
    - admin/global: Admin system-wide monitoring
    """
    # Authenticate via query param token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_access_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_info = {
        "user_id": payload.get("sub"),
        "role": payload.get("role"),
        "session_type": session_type,
        "session_id": session_id,
    }

    channel = f"{session_type}:{session_id}"
    await manager.connect(websocket, channel, user_info)

    # Also connect teachers to their exam's student events
    if session_type == "teacher":
        teacher_channel = f"teacher_feed:{session_id}"
        await manager.connect(websocket, teacher_channel, user_info)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "violation_event":
                # Student sends violation → broadcast to teacher feed
                await manager.send_to_channel(
                    f"teacher_feed:{data.get('exam_id', session_id)}",
                    {
                        "type": "student_violation",
                        "student_id": user_info["user_id"],
                        "event": data,
                    },
                )
                # Also broadcast to admin
                await manager.send_to_channel(
                    "admin:global",
                    {
                        "type": "violation_alert",
                        "student_id": user_info["user_id"],
                        "event": data,
                    },
                )

            elif msg_type == "trust_score_update":
                # Broadcast trust score to teacher
                await manager.send_to_channel(
                    f"teacher_feed:{data.get('exam_id', session_id)}",
                    {
                        "type": "trust_score",
                        "student_id": user_info["user_id"],
                        "trust_score": data.get("trust_score"),
                        "risk_level": data.get("risk_level"),
                    },
                )

            elif msg_type == "code_update":
                # Live code preview for teachers
                await manager.send_to_channel(
                    f"teacher_feed:{data.get('exam_id', session_id)}",
                    {
                        "type": "code_preview",
                        "student_id": user_info["user_id"],
                        "code": data.get("code"),
                        "language": data.get("language"),
                    },
                )

            elif msg_type == "intervention":
                # Teacher/AI sends intervention to student
                target_channel = f"exam:{data.get('attempt_id')}"
                await manager.send_to_channel(
                    target_channel,
                    {
                        "type": "intervention",
                        "intervention_text": data.get("intervention_text"),
                        "challenge_prompt": data.get("challenge_prompt"),
                        "risk_level": data.get("risk_level"),
                    },
                )

            elif msg_type == "camera_event":
                # Camera monitoring events → teacher feed
                await manager.send_to_channel(
                    f"teacher_feed:{data.get('exam_id', session_id)}",
                    {
                        "type": "camera_alert",
                        "student_id": user_info["user_id"],
                        "event_type": data.get("event_type"),
                        "face_count": data.get("face_count", 1),
                        "confidence": data.get("confidence", 1.0),
                    },
                )

            elif msg_type == "audio_event":
                # Audio monitoring events → teacher feed
                await manager.send_to_channel(
                    f"teacher_feed:{data.get('exam_id', session_id)}",
                    {
                        "type": "audio_alert",
                        "student_id": user_info["user_id"],
                        "event_type": data.get("event_type"),
                        "volume_level": data.get("volume_level", 0),
                        "voice_count": data.get("voice_count", 0),
                    },
                )

            elif msg_type == "monitoring_snapshot":
                # Full monitoring snapshot from student → teacher
                await manager.send_to_channel(
                    f"teacher_feed:{data.get('exam_id', session_id)}",
                    {
                        "type": "student_snapshot",
                        "student_id": user_info["user_id"],
                        "trust_score": data.get("trust_score"),
                        "risk_level": data.get("risk_level"),
                        "camera_status": data.get("camera_status"),
                        "audio_status": data.get("audio_status"),
                        "tab_visible": data.get("tab_visible", True),
                        "fullscreen": data.get("fullscreen", True),
                    },
                )

            elif msg_type == "force_pause":
                # Teacher forces student exam pause
                target_channel = f"exam:{data.get('attempt_id')}"
                await manager.send_to_channel(
                    target_channel,
                    {
                        "type": "exam_paused",
                        "reason": data.get("reason", "Paused by instructor"),
                        "paused_by": user_info["user_id"],
                    },
                )

            elif msg_type == "force_terminate":
                # Teacher/Admin terminates student exam
                target_channel = f"exam:{data.get('attempt_id')}"
                await manager.send_to_channel(
                    target_channel,
                    {
                        "type": "exam_terminated",
                        "reason": data.get("reason", "Terminated by instructor"),
                        "terminated_by": user_info["user_id"],
                    },
                )

            elif msg_type == "timer_sync":
                # Broadcast timer to specific exam session
                await manager.send_to_user(websocket, {
                    "type": "timer_sync",
                    "remaining_seconds": data.get("remaining_seconds"),
                })

            elif msg_type == "ping":
                await manager.send_to_user(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
        if session_type == "teacher":
            manager.disconnect(websocket, f"teacher_feed:{session_id}")
        # Notify teacher about student disconnect
        if session_type == "exam":
            await manager.send_to_channel(
                f"teacher_feed:{session_id}",
                {
                    "type": "student_disconnect",
                    "student_id": user_info["user_id"],
                },
            )
