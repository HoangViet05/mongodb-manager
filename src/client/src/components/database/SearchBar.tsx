import { useEffect, useRef, useState } from 'react';

interface SearchBarProps {
  visible: boolean;
  availableFields: string[];
  initialField?: string;
  initialValue?: string;
  onSearch: (field: string, value: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function SearchBar({
  visible,
  availableFields,
  initialField,
  initialValue,
  onSearch,
  onClear,
  onClose,
}: SearchBarProps) {
  const [field, setField] = useState(initialField ?? availableFields[0] ?? '_id');
  const [value, setValue] = useState(initialValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  useEffect(() => {
    if (initialField !== undefined) setField(initialField);
  }, [initialField]);

  useEffect(() => {
    if (initialValue !== undefined) setValue(initialValue);
  }, [initialValue]);

  if (!visible) return null;

  const fieldOptions = ['_id', ...availableFields.filter(f => f !== '_id')];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() === '') {
      onClear();
    } else {
      onSearch(field, value.trim());
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/10 p-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <select
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {fieldOptions.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          placeholder={`Search by ${field}...`}
          className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm rounded hover:from-green-600 hover:to-emerald-700 transition-all shadow"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => { setValue(''); onClear(); }}
          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
          title="Close (Esc)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </form>
    </div>
  );
}
