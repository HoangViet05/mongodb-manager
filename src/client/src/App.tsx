import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/appStore';
import { ConnectionPanel } from './components/connection/ConnectionPanel';
import { DatabaseExplorer } from './components/database/DatabaseExplorer';

function App() {
  const theme = useAppStore((state) => state.theme);
  const activeConnectionId = useAppStore((state) => state.activeConnectionId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
      <Toaster
        position="top-right"
        toastOptions={{
          success: {
            duration: 3000,
            style: {
              background: '#10b981',
              color: '#fff',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#ef4444',
              color: '#fff',
            },
          },
        }}
      />

      <div className="flex h-screen relative">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300 overflow-hidden flex-shrink-0`}>
          <div className="w-80">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    MongoDB Manager
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Database Management</p>
                </div>
              </div>
            </div>
            <ConnectionPanel />
          </div>
        </aside>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-lg p-1.5 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          style={{ left: sidebarOpen ? '320px' : '0px', transition: 'left 0.3s' }}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {activeConnectionId ? (
            <DatabaseExplorer />
          ) : (
            <div className="p-8">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
                      Welcome to MongoDB Manager
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
                      Connect to a MongoDB instance to get started
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Select a connection from the sidebar or create a new one</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
