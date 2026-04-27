// State Persistence Service for ClubBoard
// Handles all localStorage operations for node positions, colors, camera visibility, etc.

import { Node } from 'reactflow';
import { AnnotationColor } from '../types/annotations';

// ============================================================================
// Type Definitions
// ============================================================================

export interface NodePosition {
  x: number;
  y: number;
}

export interface CameraVisibilityState {
  hiddenIds: string[];
  showDimmed: boolean;
}

export interface StateExport {
  version: string;
  timestamp: string;
  connectionId: string;
  database: string;
  data: {
    nodePositions: Record<string, NodePosition>;
    nodeColors: Record<string, string>;
    cameraVisibility: CameraVisibilityState;
    annotations: Record<string, any>;
    missionLimits: Record<string, number>;
  };
}

export interface ImportResult {
  success: boolean;
  error?: string;
  migratedFields?: string[];
}

interface StorageError {
  operation: 'read' | 'write' | 'delete';
  key: string;
  error: Error;
  timestamp: string;
}

// ============================================================================
// StatePersistenceService Class
// ============================================================================

class StatePersistenceService {
  private errorLog: StorageError[] = [];
  private readonly STORAGE_VERSION = '1.0.0';

  // Generate storage key following pattern: {feature}:{boardKey}:{database}
  // Note: We use database name only (not connectionId) for stable keys across server restarts
  private generateKey(feature: string, connectionId: string, database: string, boardKey: string = 'club-board'): string {
    // Use only database name for stable localStorage keys
    // connectionId changes on server restart, so we can't use it
    return `${feature}:${boardKey}:${database}`;
  }

  // ============================================================================
  // Safe Storage Wrapper Methods
  // ============================================================================

  private safeRead<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaultValue;

      const parsed = JSON.parse(raw);
      return parsed as T;
    } catch (error) {
      this.handleStorageError(error as Error, 'read', key);
      return defaultValue;
    }
  }

  private safeWrite(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if ((error as Error).name === 'QuotaExceededError') {
        console.warn('[StatePersistence] Storage quota exceeded, attempting cleanup...');
        this.clearOldData();
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (retryError) {
          this.handleStorageError(retryError as Error, 'write', key);
          return false;
        }
      }
      this.handleStorageError(error as Error, 'write', key);
      return false;
    }
  }

  private handleStorageError(error: Error, operation: 'read' | 'write' | 'delete', key: string): void {
    const storageError: StorageError = {
      operation,
      key,
      error,
      timestamp: new Date().toISOString()
    };

    console.error('[StatePersistence]', storageError);
    this.errorLog.push(storageError);

    // Notify user for critical errors
    if (error.name === 'QuotaExceededError') {
      this.notifyUser('Storage quota exceeded. Some settings may not be saved.', 'warning');
    }
  }

  private clearOldData(): void {
    // Simple cleanup: remove oldest entries if storage is full
    // In a production app, you'd want more sophisticated logic
    try {
      const keys = Object.keys(localStorage);
      const oldKeys = keys.filter(k => k.includes('club-board')).slice(0, 5);
      oldKeys.forEach(k => localStorage.removeItem(k));
      console.log('[StatePersistence] Cleared old data:', oldKeys);
    } catch (error) {
      console.error('[StatePersistence] Failed to clear old data:', error);
    }
  }

  private notifyUser(message: string, type: 'info' | 'warning' | 'error'): void {
    // Simple console notification - in production, use a toast/notification system
    console[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log'](`[User Notification] ${message}`);
  }

  // ============================================================================
  // Node Position Persistence
  // ============================================================================

  saveNodePositions(nodes: Node[], connectionId: string, database: string): void {
    const positions: Record<string, NodePosition> = {};
    nodes.forEach(node => {
      positions[node.id] = { x: node.position.x, y: node.position.y };
    });

    const key = this.generateKey('node-positions', connectionId, database);
    console.log('[StatePersistence] saveNodePositions:', { key, count: Object.keys(positions).length });
    this.safeWrite(key, positions);
  }

  loadNodePositions(connectionId: string, database: string): Record<string, NodePosition> {
    const key = this.generateKey('node-positions', connectionId, database);
    const result = this.safeRead<Record<string, NodePosition>>(key, {});
    console.log('[StatePersistence] loadNodePositions:', { key, count: Object.keys(result).length });
    return result;
  }

  // ============================================================================
  // Camera Visibility Persistence
  // ============================================================================

  saveCameraVisibility(hiddenIds: Set<string>, showDimmed: boolean, connectionId: string, database: string): void {
    const state: CameraVisibilityState = {
      hiddenIds: Array.from(hiddenIds),
      showDimmed
    };

    const key = this.generateKey('camera-visibility', connectionId, database);
    this.safeWrite(key, state);
  }

  loadCameraVisibility(connectionId: string, database: string): CameraVisibilityState {
    const key = this.generateKey('camera-visibility', connectionId, database);
    return this.safeRead<CameraVisibilityState>(key, { hiddenIds: [], showDimmed: false });
  }

  // ============================================================================
  // Node Color Persistence
  // ============================================================================

  saveNodeColors(nodes: Node[], connectionId: string, database: string): void {
    const colors: Record<string, string> = {};
    nodes.forEach(node => {
      if (node.data?.color) {
        colors[node.id] = node.data.color;
      }
    });

    const key = this.generateKey('node-colors', connectionId, database);
    this.safeWrite(key, colors);
  }

  loadNodeColors(connectionId: string, database: string): Record<string, string> {
    const key = this.generateKey('node-colors', connectionId, database);
    return this.safeRead<Record<string, string>>(key, {});
  }

  // ============================================================================
  // Mission Limits Persistence
  // ============================================================================

  saveMissionLimits(limits: Record<string, number>, connectionId: string, database: string): void {
    const key = this.generateKey('mission-limits', connectionId, database);
    this.safeWrite(key, limits);
  }

  loadMissionLimits(connectionId: string, database: string): Record<string, number> {
    const key = this.generateKey('mission-limits', connectionId, database);
    return this.safeRead<Record<string, number>>(key, {});
  }

  // ============================================================================
  // Theme Preference Persistence (Global)
  // ============================================================================

  saveTheme(theme: 'light' | 'dark'): void {
    this.safeWrite('theme', theme);
  }

  loadTheme(): 'light' | 'dark' {
    return this.safeRead<'light' | 'dark'>('theme', 'light');
  }

  // ============================================================================
  // Export/Import Functionality
  // ============================================================================

  exportState(connectionId: string, database: string): StateExport {
    return {
      version: this.STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      connectionId,
      database,
      data: {
        nodePositions: this.loadNodePositions(connectionId, database),
        nodeColors: this.loadNodeColors(connectionId, database),
        cameraVisibility: this.loadCameraVisibility(connectionId, database),
        annotations: {}, // Will be populated from annotationStorage
        missionLimits: this.loadMissionLimits(connectionId, database)
      }
    };
  }

  importState(data: StateExport, connectionId: string, database: string): ImportResult {
    try {
      // Validate structure
      if (!data.version || !data.timestamp || !data.data) {
        return { success: false, error: 'Invalid export format' };
      }

      // Apply state
      if (data.data.nodePositions) {
        const key = this.generateKey('node-positions', connectionId, database);
        this.safeWrite(key, data.data.nodePositions);
      }

      if (data.data.nodeColors) {
        const key = this.generateKey('node-colors', connectionId, database);
        this.safeWrite(key, data.data.nodeColors);
      }

      if (data.data.cameraVisibility) {
        const key = this.generateKey('camera-visibility', connectionId, database);
        this.safeWrite(key, data.data.cameraVisibility);
      }

      if (data.data.missionLimits) {
        const key = this.generateKey('mission-limits', connectionId, database);
        this.safeWrite(key, data.data.missionLimits);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================================================
  // Reset Functionality
  // ============================================================================

  clearState(connectionId: string, database: string): void {
    const features = ['node-positions', 'node-colors', 'camera-visibility', 'mission-limits', 'annotation-boxes'];
    
    features.forEach(feature => {
      const key = this.generateKey(feature, connectionId, database);
      try {
        localStorage.removeItem(key);
      } catch (error) {
        this.handleStorageError(error as Error, 'delete', key);
      }
    });

    console.log('[StatePersistence] Cleared state for context:', { connectionId, database });
  }
}

// Export singleton instance
export const statePersistenceService = new StatePersistenceService();
