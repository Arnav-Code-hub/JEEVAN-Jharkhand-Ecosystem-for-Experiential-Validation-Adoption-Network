'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export function useOfflineSync(token: string | null, onSyncSuccess: (syncedCount: number) => void) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingQueueLength, setPendingQueueLength] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updateQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token]);

  const updateQueueCount = () => {
    try {
      const queue = JSON.parse(localStorage.getItem('jeevan_offline_reports') || '[]');
      setPendingQueueLength(queue.length);
    } catch {
      setPendingQueueLength(0);
    }
  };

  const queueReport = (payload: any) => {
    try {
      const queue = JSON.parse(localStorage.getItem('jeevan_offline_reports') || '[]');
      const offlineRecord = {
        ...payload,
        id: `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
      };
      queue.push(offlineRecord);
      localStorage.setItem('jeevan_offline_reports', JSON.stringify(queue));
      updateQueueCount();
      return offlineRecord;
    } catch (e) {
      console.error('Failed to queue offline report:', e);
      return null;
    }
  };

  const triggerSync = async () => {
    if (syncing || !navigator.onLine || !token) return;

    try {
      const queue = JSON.parse(localStorage.getItem('jeevan_offline_reports') || '[]');
      if (queue.length === 0) return;

      setSyncing(true);
      let successCount = 0;
      const remainingQueue = [];

      for (const item of queue) {
        try {
          const { id, ...payload } = item;

          await axios.post('http://localhost:3000/citizen/issues', payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
          successCount++;
        } catch (err) {
          console.error('Failed to sync offline item:', item, err);
          remainingQueue.push(item);
        }
      }

      localStorage.setItem('jeevan_offline_reports', JSON.stringify(remainingQueue));
      updateQueueCount();

      if (successCount > 0) {
        onSyncSuccess(successCount);
      }
    } catch (e) {
      console.error('Critical sync failure:', e);
    } finally {
      setSyncing(false);
    }
  };

  return {
    isOnline,
    pendingQueueLength,
    syncing,
    queueReport,
    triggerSync,
  };
}
