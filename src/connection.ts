import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, Snapshot, User } from './types';
import { clientId } from './client-id';

export async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

type Pending = { resolve: (data: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
export function useConnection(user: User, onExpired: () => void, onMessage: (m: ChatMessage) => void, onTyping: (data: { roomId: string; user: User }) => void) {
  const [state, setState] = useState<Snapshot>({ users: [], rooms: [], aiEnabled: false });
  const [status, setStatus] = useState('Connecting');
  const [generation, setGeneration] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, Pending>());
  const callbacks = useRef({ onExpired, onMessage, onTyping });
  callbacks.current = { onExpired, onMessage, onTyping };
  useEffect(() => {
    let stopped = false;
    let reconnect: ReturnType<typeof setTimeout>;
    let failures = 0;
    const rejectPending = () => {
      for (const p of pending.current.values()) { clearTimeout(p.timer); p.reject(new Error('Connection interrupted. Your draft is safe. Please try again.')); }
      pending.current.clear();
    };
    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/socket`);
      socket.current = ws;
      ws.onopen = () => { failures = 0; setStatus('Connected'); setGeneration(n => n + 1); };
      ws.onmessage = e => {
        if (stopped) return;
        try {
          const { event, data } = JSON.parse(e.data);
          if (event === 'state') setState(data);
          else if (event === 'message') callbacks.current.onMessage(data);
          else if (event === 'typing') callbacks.current.onTyping(data);
          else if (event === 'reply') {
            const p = pending.current.get(data.id);
            if (p) { clearTimeout(p.timer); pending.current.delete(data.id); data.error ? p.reject(new Error(data.error)) : p.resolve(data.result); }
          }
        } catch { /* Ignore malformed server frames without breaking the UI. */ }
      };
      ws.onclose = async e => {
        rejectPending();
        if (stopped) return;
        if (e.code === 4001) { callbacks.current.onExpired(); return; }
        setStatus('Reconnecting');
        // A failed handshake cannot expose the HTTP status to a browser WebSocket.
        try {
          const response = await fetch('/api/me');
          if (response.status === 401) { if (!stopped) callbacks.current.onExpired(); return; }
        } catch { /* Network unavailable: reconnect with backoff. */ }
        if (!stopped) reconnect = setTimeout(connect, Math.min(15000, 800 * 2 ** failures++));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { stopped = true; clearTimeout(reconnect); socket.current?.close(); rejectPending(); };
  }, [user.id]);
  const request = useCallback(<T = any,>(action: string, data: unknown): Promise<T> => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('You are reconnecting. Please wait a moment.'));
    const id = clientId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.current.delete(id); reject(new Error('The server did not reply. Please try again.')); }, 12000);
      pending.current.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, action, data }));
    });
  }, []);
  return { state, status, generation, request };
}
