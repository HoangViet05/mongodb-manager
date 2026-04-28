import { useEffect, useState } from 'react';
import type { Doc } from './DocCard';

interface DeleteConfirmModalProps {
  doc: Doc | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteConfirmModal({ doc, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, deleting, onCancel]);

  if (!doc) return null;

  const previewEntries = Object.entries(doc)
    .filter(([k]) => k !== '_id' && k !== '__v')
    .slice(0, 3);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => { if (!deleting) onCancel(); }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Xác nhận xoá document</h3>
        </div>

        <div className="mb-4 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Bạn có chắc muốn xoá document này? Hành động không thể hoàn tác.
          </p>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs">
              <span className="text-gray-500 dark:text-gray-400">_id: </span>
              <span className="font-mono text-gray-800 dark:text-gray-200">{String(doc._id)}</span>
            </div>
            {previewEntries.map(([k, v]) => (
              <div key={k} className="text-xs mt-1">
                <span className="text-gray-500 dark:text-gray-400">{k}: </span>
                <span className="text-gray-800 dark:text-gray-200">
                  {v === null ? 'null' : typeof v === 'object' ? '{…}' : String(v).slice(0, 60)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow disabled:opacity-50"
          >
            {deleting ? 'Đang xoá...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
