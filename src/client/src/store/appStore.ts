import { create } from 'zustand';

export interface ConnectionProfile {
  id: string;
  name: string;
  uri?: string;
  host: string;
  port: number;
  username?: string;
  database?: string;
  createdAt: string;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface ConnectionState {
  id: string;
  status: ConnectionStatus;
  error?: string;
}

export interface DocumentResult {
  documents: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  autoDismiss: boolean;
}

interface AppStore {
  // Connections
  connections: ConnectionProfile[];
  activeConnectionId: string | null;
  connectionStatuses: Record<string, ConnectionState>;
  setConnections: (connections: ConnectionProfile[]) => void;
  setActiveConnection: (id: string | null) => void;
  updateConnectionStatus: (id: string, status: ConnectionState) => void;

  // Navigation
  selectedDatabase: string | null;
  selectedCollection: string | null;
  setSelectedDatabase: (db: string | null) => void;
  setSelectedCollection: (col: string | null) => void;

  // Documents
  documents: DocumentResult | null;
  queryFilter: string;
  sortField: string | null;
  sortOrder: 1 | -1;
  pageSize: 10 | 20 | 50 | 100;
  currentPage: number;
  setDocuments: (docs: DocumentResult | null) => void;
  setQueryFilter: (filter: string) => void;
  setSortField: (field: string | null) => void;
  setSortOrder: (order: 1 | -1) => void;
  setPageSize: (size: 10 | 20 | 50 | 100) => void;
  setCurrentPage: (page: number) => void;

  // UI
  theme: 'light' | 'dark';
  loading: Record<string, boolean>;
  notifications: Notification[];
  setTheme: (theme: 'light' | 'dark') => void;
  setLoading: (key: string, loading: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Connections
  connections: [],
  activeConnectionId: null,
  connectionStatuses: {},
  setConnections: (connections) => set({ connections }),
  setActiveConnection: (id) => set({ activeConnectionId: id }),
  updateConnectionStatus: (id, status) =>
    set((state) => ({
      connectionStatuses: { ...state.connectionStatuses, [id]: status },
    })),

  // Navigation
  selectedDatabase: null,
  selectedCollection: null,
  setSelectedDatabase: (db) => set({ selectedDatabase: db }),
  setSelectedCollection: (col) => set({ selectedCollection: col }),

  // Documents
  documents: null,
  queryFilter: '',
  sortField: null,
  sortOrder: 1,
  pageSize: 20,
  currentPage: 1,
  setDocuments: (docs) => set({ documents: docs }),
  setQueryFilter: (filter) => set({ queryFilter: filter }),
  setSortField: (field) => set({ sortField: field }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setPageSize: (size) => set({ pageSize: size }),
  setCurrentPage: (page) => set({ currentPage: page }),

  // UI
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  loading: {},
  notifications: [],
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setLoading: (key, loading) =>
    set((state) => ({
      loading: { ...state.loading, [key]: loading },
    })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: Math.random().toString(36).slice(2) },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
