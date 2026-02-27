/**
 * ProctorForge AI - WebSocket Hook
 * Manages WebSocket connections with auto-reconnection and message type routing.
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
    sessionType: 'exam' | 'teacher' | 'admin';
    sessionId: string;
    token: string;
    onMessage?: (data: any) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

export function useWebSocket({
    sessionType,
    sessionId,
    token,
    onMessage,
    onConnect,
    onDisconnect,
}: UseWebSocketOptions) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 10;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8001'}/ws/${sessionType}/${sessionId}?token=${token}`;

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                reconnectAttempts.current = 0;
                onConnect?.();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessage?.(data);
                } catch { }
            };

            ws.onclose = () => {
                onDisconnect?.();
                // Auto-reconnect with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                }
            };

            ws.onerror = () => {
                ws.close();
            };

            wsRef.current = ws;
        } catch { }
    }, [wsUrl, onMessage, onConnect, onDisconnect]);

    const send = useCallback((data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectAttempts.current = maxReconnectAttempts; // prevent reconnection
        wsRef.current?.close();
    }, []);

    useEffect(() => {
        // Don't connect until we have a real session ID
        if (!sessionId || sessionId === 'pending') return;
        connect();
        return () => {
            disconnect();
        };
    }, [sessionId, connect, disconnect]);

    return { send, disconnect, reconnect: connect };
}
