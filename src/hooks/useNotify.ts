import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResetEvent } from '../data/types';
import { assetUrl } from '../lib/base';

const STORAGE_KEY = 'cr.notify';
const POLL_INTERVAL = 120_000;

export interface UseNotifyOptions {
  latest: ResetEvent | null;
  /** 轮询回调，用于拉取最新快照 */
  poll: () => Promise<ResetEvent[] | null>;
  /** 每完成一次轮询触发 */
  onPoll?: (count: number) => void;
  /** 检测到新的重置事件时触发 */
  onFire: (event: ResetEvent) => void;
  /** 开关状态变化时触发 */
  onToggle?: (enabled: boolean) => void;
}

export interface UseNotifyResult {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  enabled: boolean;
  toggle: () => Promise<void>;
}

function readStoredEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useNotify({ latest, poll, onPoll, onFire, onToggle }: UseNotifyOptions): UseNotifyResult {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    supported ? Notification.permission : 'unsupported',
  );
  const [enabled, setEnabled] = useState<boolean>(readStoredEnabled);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const lastSeenId = useRef<string | null>(null);
  const onFireRef = useRef(onFire);
  const onToggleRef = useRef(onToggle);
  const onPollRef = useRef(onPoll);
  onFireRef.current = onFire;
  onToggleRef.current = onToggle;
  onPollRef.current = onPoll;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register(assetUrl('sw.js'))
      .then((reg) => {
        if (!cancelled) setRegistration(reg);
      })
      .catch(() => {
        /* 注册失败时降级为页面内 new Notification() */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      void poll().then((next) => {
        if (next) onPollRef.current?.(next.length);
      });
    }, POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [enabled, poll]);

  // 首次加载只建立基线；之后出现新的最新事件才通知。
  useEffect(() => {
    if (!latest) return;
    if (lastSeenId.current === null) {
      lastSeenId.current = latest.id;
      return;
    }
    if (!enabled || latest.id === lastSeenId.current) return;

    lastSeenId.current = latest.id;
    const title = 'Codex reset';
    const options: NotificationOptions = { body: latest.text, tag: latest.id };
    if (registration) {
      void registration.showNotification(title, options).catch(() => {});
    } else if (supported) {
      try {
        new Notification(title, options);
      } catch {
        /* 浏览器拒绝时静默降级 */
      }
    }
    onFireRef.current(latest);
  }, [enabled, latest, registration, supported]);

  const toggle = useCallback(async () => {
    if (!supported) return;

    if (enabled) {
      setEnabled(false);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* 隐私模式下不可写 */
      }
      onToggleRef.current?.(false);
      return;
    }

    let result: NotificationPermission = Notification.permission;
    if (result === 'default') {
      result = await Notification.requestPermission();
    }
    setPermission(result);
    if (result !== 'granted') {
      onToggleRef.current?.(false);
      return;
    }
    setEnabled(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* 隐私模式下不可写 */
    }
    onToggleRef.current?.(true);
  }, [enabled, supported]);

  return { supported, permission, enabled, toggle };
}
