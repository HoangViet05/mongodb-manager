import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { DocumentViewer } from './DocumentViewer';
import apiClient from '../../api/apiClient';

interface Database {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
}

interface Collection {
  name: string;
  type: string;
}

export function DatabaseExplorer() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const activeConnectionId = useAppStore((state) => state.activeConnectionId);

  useEffect(() => {
    if (activeConnectionId) {
      loadDatabases();
      // Auto-select arena.ai database if exists
      setTimeout(() => {
        const arenaDb = databases.find(db => db.name === 'arena.ai');
        if (arenaDb) {
          loadCollections('arena.ai');
        }
      }, 500);
    }
  }, [activeConnectionId]);

  const loadDatabases = async () => {
    if (!activeConnectionId) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/connections/${activeConnectionId}/databases`);
      if (response.data.success) {
        setDatabases(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load databases:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async (dbName: string) => {
    if (!activeConnectionId) return;
    setLoading(true);
    setSelectedCollection(null);
    try {
      const response = await apiClient.get(`/connections/${activeConnectionId}/databases/${dbName}/collections`);
      console.log('Collections response:', response.data);
      if (response.data.success) {
        setCollections(response.data.data);
        setSelectedDb(dbName);
        const usersCol = response.data.data.find((col: Collection) => col.name === 'users');
        if (usersCol) {
          setSelectedCollection('users');
        }
      } else {
        console.error('Failed to load collections:', response.data.error);
      }
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!activeConnectionId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p>No active connection</p>
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* Collapsible panel: Databases + Collections */}
      <div className={`flex transition-all duration-300 flex-shrink-0 overflow-hidden ${panelOpen ? 'w-[512px]' : 'w-0'}`}>
        {/* Databases List */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Databases
            </h3>
          </div>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 60px)' }}>
            {loading && databases.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="p-2 space-y-1">
                {databases.map((db) => (
                  <button
                    key={db.name}
                    onClick={() => loadCollections(db.name)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                      selectedDb === db.name
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-medium truncate">{db.name}</div>
                    <div className="text-xs opacity-75">
                      {(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Collections List */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Collections
            </h3>
          </div>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 60px)' }}>
            {!selectedDb ? (
              <div className="p-4 text-center text-gray-500 text-sm">Select a database</div>
            ) : loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : collections.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                No collections found
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {collections.map((col) => (
                  <button
                    key={col.name}
                    onClick={() => {
                      setSelectedCollection(col.name);
                      setReloadToken(t => t + 1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                      selectedCollection === col.name
                        ? 'bg-white dark:bg-gray-700 shadow-md border-2 border-green-500'
                        : 'hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-medium truncate">{col.name}</div>
                    <div className="text-xs text-gray-500">{col.type}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setPanelOpen(o => !o)}
        className="absolute top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-lg p-1 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
        style={{ left: panelOpen ? '512px' : '0px', transition: 'left 0.3s' }}
        title={panelOpen ? 'Hide panel' : 'Show panel'}
      >
        <svg
          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${panelOpen ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Documents Viewer */}
      <div className="flex-1 min-w-0">
        {selectedDb && selectedCollection ? (
          <DocumentViewer
            connectionId={activeConnectionId}
            database={selectedDb}
            collection={selectedCollection}
            reloadToken={reloadToken}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg">Select a collection to view documents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
