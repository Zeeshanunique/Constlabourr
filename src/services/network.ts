import { AppState, AppStateStatus } from 'react-native';
import { projectId } from '../utils/supabase/info';

type NetworkListener = (isOnline: boolean) => void;

class NetworkService {
  private static instance: NetworkService;
  private isOnlineStatus: boolean = true;
  private listeners: Set<NetworkListener> = new Set();
  private lastCheckTimestamp: number = 0;
  private isChecking: boolean = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Check initial connectivity
    this.checkReachability();

    // Re-check when app returns to foreground
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        this.checkReachability();
      }
    });

    // Background reachability poll every 25 seconds
    this.checkInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        this.checkReachability();
      }
    }, 25000);
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  public get isOnline(): boolean {
    return this.isOnlineStatus;
  }

  /**
   * Actively probes the Supabase server health endpoint to verify actual packet exchange
   * (does not assume local Wi-Fi or cellular connection guarantees internet reachability).
   */
  public async checkReachability(): Promise<boolean> {
    if (this.isChecking) return this.isOnlineStatus;
    this.isChecking = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout

      const healthUrl = `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const reachable = response.ok;
      this.setOnlineStatus(reachable);
      return reachable;
    } catch {
      // Network failure, timeout, or DNS resolution failure
      this.setOnlineStatus(false);
      return false;
    } finally {
      this.lastCheckTimestamp = Date.now();
      this.isChecking = false;
    }
  }

  public notifyRequestFailed() {
    // Immediately mark offline when an API call fails due to network
    this.setOnlineStatus(false);
  }

  public notifyRequestSuccess() {
    if (!this.isOnlineStatus) {
      this.setOnlineStatus(true);
    }
  }

  private setOnlineStatus(online: boolean) {
    if (this.isOnlineStatus !== online) {
      this.isOnlineStatus = online;
      this.listeners.forEach((listener) => {
        try {
          listener(online);
        } catch (e) {
          console.error('Error notifying network listener:', e);
        }
      });
    }
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Notify immediately with current status
    listener(this.isOnlineStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const networkService = NetworkService.getInstance();
