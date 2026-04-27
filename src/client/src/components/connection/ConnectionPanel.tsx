import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  listConnections,
  createConnection,
  connectToMongo,
  disconnectFromMongo,
  deleteConnection,
  getConnectionStatus,
} from '../../api/connectionsApi';
import toast from 'react-hot-toast';

export function ConnectionPanel() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    uri: '',
    host: 'localhost',
    port: 27017,
    username: '',
    password: '',
    database: '',
  });

  const connections = useAppStore((state) => state.connections);
  const setConnections = useAppStore((state) => state.setConnections);
  const activeConnectionId = useAppStore((state) => state.activeConnectionId);
  const setActiveConnection = useAppStore((state) => state.setActiveConnection);
  const connectionStatuses = useAppStore((state) => state.connectionStatuses);
  const updateConnectionStatus = useAppStore((state) => state.updateConnectionStatus);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await listConnections();
      setConnections(data);
      // Fetch status for each connection
      await Promise.all(
        data.map(async (conn) => {
          try {
            const status = await getConnectionStatus(conn.id);
            if (status.status !== 'connected') {
              // Auto-reconnect if not connected
              const reconnected = await connectToMongo(conn.id);
              updateConnectionStatus(conn.id, reconnected);
              if (reconnected.status === 'connected') {
                setActiveConnection(conn.id);
              }
            } else {
              updateConnectionStatus(conn.id, status);
              setActiveConnection(conn.id);
            }
          } catch {
            // ignore status fetch errors
          }
        })
      );
    } catch (err) {
      toast.error(`Failed to load connections: ${(err as Error).message}`);
    }
  };

  const handleCreate = async () => {
    try {
      await createConnection(formData);
      toast.success('Connection profile created');
      setShowForm(false);
      setFormData({
        name: '',
        uri: '',
        host: 'localhost',
        port: 27017,
        username: '',
        password: '',
        database: '',
      });
      loadConnections();
    } catch (err) {
      toast.error(`Failed to create connection: ${(err as Error).message}`);
    }
  };

  const handleConnect = async (id: string) => {
    try {
      const status = await connectToMongo(id);
      updateConnectionStatus(id, status);
      if (status.status === 'connected') {
        setActiveConnection(id);
        toast.success('Connected to MongoDB');
      } else {
        toast.error(`Connection failed: ${status.error}`);
      }
    } catch (err) {
      toast.error(`Connection failed: ${(err as Error).message}`);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnectFromMongo(id);
      updateConnectionStatus(id, { id, status: 'disconnected' });
      if (activeConnectionId === id) {
        setActiveConnection(null);
      }
      toast.success('Disconnected');
    } catch (err) {
      toast.error(`Disconnect failed: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this connection profile?')) return;
    try {
      await deleteConnection(id);
      toast.success('Connection deleted');
      loadConnections();
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Connections
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
        >
          {showForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-inner">
          <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">New Connection</h4>
          <input
            type="text"
            placeholder="Connection Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
          <input
            type="text"
            placeholder="MongoDB URI (optional)"
            value={formData.uri}
            onChange={(e) => setFormData({ ...formData, uri: e.target.value })}
            className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              placeholder="Host"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
            <input
              type="number"
              placeholder="Port"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            onClick={handleCreate}
            className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            Create Connection
          </button>
        </div>
      )}

      <div className="space-y-2">
        {connections.length === 0 && !showForm && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">No connections yet</p>
            <p className="text-xs mt-1">Click "New" to create one</p>
          </div>
        )}
        {connections.map((conn) => {
          const status = connectionStatuses[conn.id];
          const isActive = activeConnectionId === conn.id;
          const isConnected = status?.status === 'connected';
          const isError = status?.status === 'error';
          
          return (
            <div
              key={conn.id}
              className={`p-3 rounded-xl border-2 transition-all ${
                isActive
                  ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isConnected ? 'bg-green-500 animate-pulse' : 
                      isError ? 'bg-red-500' : 
                      'bg-gray-400'
                    }`} />
                    <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{conn.name}</div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 break-all">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                    <span className="break-all">{conn.host}:{conn.port}</span>
                  </div>
                  {status && (
                    <div className={`text-xs mt-1 font-medium ${
                      isConnected ? 'text-green-600 dark:text-green-400' :
                      isError ? 'text-red-600 dark:text-red-400' :
                      'text-gray-500 dark:text-gray-500'
                    }`}>
                      {status.status === 'connected' && '● Connected'}
                      {status.status === 'disconnected' && '○ Disconnected'}
                      {status.status === 'error' && '✕ Error'}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                {isConnected ? (
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    className="flex-1 px-2 py-1.5 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all font-medium shadow-sm"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(conn.id)}
                    className="flex-1 px-2 py-1.5 text-xs bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all font-medium shadow-sm"
                  >
                    Connect
                  </button>
                )}
                <button
                  onClick={() => handleDelete(conn.id)}
                  className="px-2 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all font-medium shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
