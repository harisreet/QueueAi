"""WebSocket connection manager for real-time queue broadcasting."""
from typing import Dict, Set
from fastapi import WebSocket
import json


class ConnectionManager:
    def __init__(self):
        # room → set of websocket connections
        self._rooms: Dict[str, Set[WebSocket]] = {}
        # patient_id → websocket
        self._patient_sockets: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, room: str, client_id: str | None = None):
        await websocket.accept()
        if room not in self._rooms:
            self._rooms[room] = set()
        self._rooms[room].add(websocket)
        if client_id:
            self._patient_sockets[client_id] = websocket

    def disconnect(self, websocket: WebSocket, room: str, client_id: str | None = None):
        if room in self._rooms:
            self._rooms[room].discard(websocket)
        if client_id and client_id in self._patient_sockets:
            del self._patient_sockets[client_id]

    async def broadcast_to_room(self, room: str, event: str, data: dict):
        """Broadcast a JSON event to all clients in a room."""
        payload = json.dumps({"event": event, "data": data})
        dead = set()
        for ws in list(self._rooms.get(room, [])):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._rooms[room].discard(ws)

    async def send_to_patient(self, patient_id: str, event: str, data: dict):
        """Send a personal notification to a specific patient."""
        ws = self._patient_sockets.get(patient_id)
        if ws:
            try:
                await ws.send_text(json.dumps({"event": event, "data": data}))
            except Exception:
                del self._patient_sockets[patient_id]

    async def broadcast_queue_update(self, department: str, queue_data: list):
        """Convenience method: broadcast full queue refresh."""
        await self.broadcast_to_room(
            f"dept:{department}",
            "queue_update",
            {"department": department, "queue": queue_data},
        )

    async def broadcast_global(self, event: str, data: dict):
        await self.broadcast_to_room("global", event, data)


manager = ConnectionManager()
