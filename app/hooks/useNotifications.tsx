'use client';

import { useState, useEffect } from 'react';

export function useNotifications(userId?: string) {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    if (!userId) return;
    const es = new EventSource(`/api/notifications/stream?userId=${userId}`);
    es.onmessage = (e) => {
      // default message handler
      try { const data = JSON.parse(e.data); setEvents((s) => [data, ...s]); } catch (err) {}
    };
    es.addEventListener('notification', (e: any) => {
      try { const data = JSON.parse((e as any).data); setEvents((s) => [data, ...s]); } catch (err) {}
    });
    es.onerror = () => { es.close(); };
    return () => es.close();
  }, [userId]);

  return { events };
}
