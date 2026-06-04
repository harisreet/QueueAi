const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WSEvent = {
  event: string;
  data: Record<string, unknown>;
};

export function createWebSocket(
  path: string,
  onMessage: (event: WSEvent) => void,
  onOpen?: () => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(`${WS_URL}${path}`);

  ws.onopen = () => onOpen?.();
  ws.onclose = () => onClose?.();
  ws.onmessage = (e) => {
    try {
      const parsed: WSEvent = JSON.parse(e.data);
      onMessage(parsed);
    } catch { /* ignore malformed */ }
  };

  return ws;
}

export function connectGlobal(onMessage: (e: WSEvent) => void) {
  return createWebSocket("/ws/global", onMessage);
}

export function connectDepartment(dept: string, onMessage: (e: WSEvent) => void) {
  return createWebSocket(`/ws/department/${dept}`, onMessage);
}

export function connectPatient(patientId: string, onMessage: (e: WSEvent) => void) {
  return createWebSocket(`/ws/patient/${patientId}`, onMessage);
}
