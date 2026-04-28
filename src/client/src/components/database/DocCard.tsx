import { useEffect, useState } from 'react';

export interface Doc {
  [key: string]: unknown;
}

type FieldType = 'string' | 'number' | 'boolean' | 'null' | 'json';

function detectFieldType(value: unknown): FieldType {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'object') return 'json';
  return 'string';
}

function scrollToExpandedCard(cardElement: HTMLDivElement): void {
  const cardRect = cardElement.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  if (cardRect.bottom <= viewportHeight && cardRect.top >= 0) return;
  cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

interface DocCardProps {
  doc: Doc;
  index: number;
  isSelected: boolean;
  isEditing: boolean;
  onClick?: () => void;
  onEnterEdit: () => void;
  onSave: (updated: Doc) => Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
  priorityFields?: string[];
  cardRef?: React.RefObject<HTMLDivElement>;
  positionOffset?: number;
}

export function DocCard({
  doc,
  index,
  isSelected,
  isEditing,
  onClick,
  onEnterEdit,
  onSave,
  onCancel,
  onDelete,
  priorityFields,
  cardRef,
  positionOffset,
}: DocCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditing) {
      const initial: Record<string, string> = {};
      for (const [k, v] of Object.entries(doc)) {
        if (k === '_id' || k === '__v') continue;
        const type = detectFieldType(v);
        if (type === 'json') {
          initial[k] = JSON.stringify(v, null, 2);
        } else if (type === 'null') {
          initial[k] = '';
        } else if (type === 'boolean') {
          initial[k] = String(v);
        } else {
          initial[k] = String(v);
        }
      }
      setDraft(initial);
      setErrors({});
    }
  }, [isEditing, doc]);

  useEffect(() => {
    if (expanded && cardRef?.current) {
      const timeoutId = setTimeout(() => {
        if (cardRef.current) scrollToExpandedCard(cardRef.current);
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [expanded, cardRef]);

  const editableEntries = Object.entries(doc).filter(([k]) => k !== '_id' && k !== '__v');

  const allFields = editableEntries;
  const priority = priorityFields ?? [];
  const priorityEntries = priority
    .map(k => [k, doc[k]] as [string, unknown])
    .filter(([, v]) => v !== undefined);
  const otherEntries = allFields.filter(([k]) => !priority.includes(k));
  const summaryEntries = [...priorityEntries, ...otherEntries].slice(0, 6);

  const handleSave = async () => {
    const updated: Doc = {};
    const newErrors: Record<string, string> = {};
    for (const [k, original] of editableEntries) {
      const raw = draft[k] ?? '';
      const type = detectFieldType(original);
      if (type === 'number') {
        if (raw.trim() === '') {
          updated[k] = null;
        } else {
          const n = Number(raw);
          if (Number.isNaN(n)) {
            newErrors[k] = 'Invalid number';
          } else {
            updated[k] = n;
          }
        }
      } else if (type === 'boolean') {
        updated[k] = raw === 'true';
      } else if (type === 'json') {
        try {
          updated[k] = JSON.parse(raw);
        } catch {
          newErrors[k] = 'Invalid JSON';
        }
      } else if (type === 'null') {
        updated[k] = raw === '' ? null : raw;
      } else {
        updated[k] = raw;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSaving(true);
    try {
      await onSave(updated);
    } finally {
      setSaving(false);
    }
  };

  const cardClickHandler = isEditing ? undefined : onClick;

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      ref={cardRef}
      className={`card-animated rounded-xl border-2 transition-all shadow-sm p-4 ${isEditing ? '' : 'cursor-pointer'}
        ${isEditing
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
          : isSelected
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-lg'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-400 hover:shadow-md'
        }`}
      style={{ transform: `translateY(${positionOffset ?? 0}px)` }}
      onClick={cardClickHandler}
      onDoubleClick={(e) => {
        if (isEditing) return;
        e.stopPropagation();
        onEnterEdit();
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {index}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-xs">
            {String(doc._id)}
          </span>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-1 text-gray-400 hover:text-green-600 transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {!isEditing && !expanded && (
        <div className="flex flex-wrap gap-2 mt-1">
          {summaryEntries.map(([k, v]) => (
            <span key={k} className="text-xs bg-gray-100 dark:bg-gray-700 rounded px-2 py-0.5">
              <span className="text-gray-500 dark:text-gray-400">{k}: </span>
              <span className="text-gray-800 dark:text-gray-200 font-medium">
                {v === null ? 'null' : typeof v === 'object' ? '{…}' : String(v).slice(0, 30)}
              </span>
            </span>
          ))}
        </div>
      )}

      {!isEditing && expanded && (
        <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto border border-gray-200 dark:border-gray-700 mt-2">
          <code className="text-gray-800 dark:text-gray-200">{JSON.stringify(doc, null, 2)}</code>
        </pre>
      )}

      {isEditing && (
        <div className="mt-2 font-mono text-xs" onClick={(e) => e.stopPropagation()} onKeyDown={handleEditKeyDown}>
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-2 px-2 py-1 text-gray-400 dark:text-gray-500">
              <span className="select-none">_id:</span>
              <span className="truncate">{String(doc._id)}</span>
            </div>
            {editableEntries.map(([k, v]) => {
              const type = detectFieldType(v);
              const value = draft[k] ?? '';
              const err = errors[k];
              const isMultiline = type === 'json' && value.includes('\n');
              return (
                <div key={k} className={`flex ${isMultiline ? 'flex-col' : 'items-baseline'} gap-2 px-2 py-1 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded ${err ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                  <span className="text-purple-700 dark:text-purple-300 select-none flex-shrink-0">{k}:</span>
                  {type === 'boolean' ? (
                    <select
                      value={value}
                      onChange={(e) => setDraft(d => ({ ...d, [k]: e.target.value }))}
                      className="bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded px-1 py-0 text-xs font-mono outline-none transition-colors text-orange-700 dark:text-orange-300"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : type === 'json' ? (
                    <textarea
                      value={value}
                      onChange={(e) => setDraft(d => ({ ...d, [k]: e.target.value }))}
                      rows={Math.min(8, value.split('\n').length)}
                      className="flex-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded px-1 py-0 text-xs font-mono outline-none transition-colors text-gray-700 dark:text-gray-200 resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setDraft(d => ({ ...d, [k]: e.target.value }))}
                      placeholder={type === 'null' ? 'null' : ''}
                      className={`flex-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded px-1 py-0 text-xs font-mono outline-none transition-colors ${type === 'number' ? 'text-blue-700 dark:text-blue-300' : type === 'null' ? 'text-gray-400' : 'text-green-700 dark:text-green-300'}`}
                    />
                  )}
                  {err && <span className="text-[10px] text-red-500 ml-2">{err}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded hover:from-blue-600 hover:to-blue-700 transition-all shadow disabled:opacity-50 font-sans"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50 font-sans"
            >
              Cancel
            </button>
            <span className="text-[10px] text-gray-400 self-center font-sans">Tip: Esc to cancel, Enter outside textarea to save</span>
          </div>
        </div>
      )}
    </div>
  );
}
