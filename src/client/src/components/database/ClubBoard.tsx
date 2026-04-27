import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  BackgroundVariant, Handle, Position, NodeProps,
  NodeDragHandler, ReactFlowProvider, useReactFlow,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { COLOR_PRESETS } from '../../types/annotations';
import { AnnotationNode } from './AnnotationNode';
import { saveAnnotations, loadAnnotations } from '../../utils/annotationStorage';
import { statePersistenceService } from '../../utils/statePersistence';
import apiClient from '../../api/apiClient';

interface Doc { [key: string]: unknown; }

// ─── Palette ──────────────────────────────────────────────────────────────────
const CLUB_COLOR  = { from: '#3b82f6', to: '#2563eb', border: '#3b82f6' }; // blue
const WORKER_COLOR = { from: '#f97316', to: '#ea580c', border: '#f97316' }; // orange

const COLORS = [
  { label: 'Blue',   from: '#3b82f6', to: '#2563eb', border: '#3b82f6' },
  { label: 'Orange', from: '#f97316', to: '#ea580c', border: '#f97316' },
  { label: 'Green',  from: '#10b981', to: '#059669', border: '#10b981' },
  { label: 'Purple', from: '#8b5cf6', to: '#7c3aed', border: '#8b5cf6' },
  { label: 'Red',    from: '#ef4444', to: '#dc2626', border: '#ef4444' },
  { label: 'Pink',   from: '#ec4899', to: '#db2777', border: '#ec4899' },
  { label: 'Teal',   from: '#14b8a6', to: '#0d9488', border: '#14b8a6' },
  { label: 'Yellow', from: '#eab308', to: '#ca8a04', border: '#eab308' },
];

type Color = typeof COLORS[0];

// ─── Color Picker ─────────────────────────────────────────────────────────────
function ColorPicker({ x, y, nodeId, onPick, onClose }: {
  x: number; y: number; nodeId: string;
  onPick: (c: Color | typeof COLOR_PRESETS[0]) => void;
  onClose: () => void;
}) {
  const isAnnotationNode = nodeId.startsWith('annotation-');
  const colors = isAnnotationNode ? COLOR_PRESETS : COLORS;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3"
        style={{ left: x, top: y }}>
        <p className="text-xs font-semibold text-gray-500 mb-2">Pick color</p>
        <div className="grid grid-cols-4 gap-1.5">
          {colors.map(c => {
            const bgStyle = isAnnotationNode
              ? { background: (c as typeof COLOR_PRESETS[0]).background }
              : { background: `linear-gradient(135deg, ${(c as Color).from}, ${(c as Color).to})` };
            return (
              <button key={c.label} title={c.label}
                onClick={() => { onPick(c); onClose(); }}
                className="w-7 h-7 rounded-lg border-2 border-white shadow hover:scale-110 transition-transform"
                style={bgStyle}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Shared renderValue helper ────────────────────────────────────────────────
function renderValue(key: string, value: unknown, _accentColor: string, onCopy: (t: string) => void) {
  if ((key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) && typeof value === 'string') {
    return (
      <button onClick={() => onCopy(value)} className="text-blue-600 hover:underline text-left break-all" title="Click to copy">
        {value.slice(0, 30)}…
      </button>
    );
  }
  if (Array.isArray(value)) {
    return <span className="text-gray-500">[{value.length} items]</span>;
  }
  if (value === null) return <span className="text-gray-400">null</span>;
  if (typeof value === 'object') return <span className="text-gray-500">{'{…}'}</span>;
  return <span className="break-all">{String(value)}</span>;
}

// ─── Mission Node ─────────────────────────────────────────────────────────────
const MISSION_COLOR = { from: '#8b5cf6', to: '#7c3aed', border: '#8b5cf6' }; // purple

// ─── Auto-collapse hook: collapse node when deselected ───────────────────────
function useAutoCollapse(selected: boolean | undefined): [boolean, () => void] {
  const [expanded, setExpanded] = useState(false);
  const prevSelectedRef = useRef(selected);
  useEffect(() => {
    if (prevSelectedRef.current && !selected && expanded) {
      setExpanded(false);
    }
    prevSelectedRef.current = selected;
  }, [selected, expanded]);
  return [expanded, () => setExpanded(v => !v)];
}

// Module-level map for object sub-expand state
const nodeObjectExpandState = new Map<string, Set<string>>();

const MissionNode = memo(function MissionNode({ data, id, selected }: NodeProps) {
  const [expanded, toggleExpanded] = useAutoCollapse(selected);
  const [, forceUpdate] = useState(0);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  if (!nodeObjectExpandState.has(id)) nodeObjectExpandState.set(id, new Set());
  const expandedObjects = nodeObjectExpandState.get(id)!;

  const toggleObjectExpand = (key: string) => {
    if (expandedObjects.has(key)) expandedObjects.delete(key);
    else expandedObjects.add(key);
    forceUpdate(n => n + 1);
  };

  const handleDoubleClick = (key: string, value: unknown) => {
    setEditingField(key);
    setEditKey(key);
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''));
  };
  const handleSaveEdit = () => setEditingField(null);
  const handleCancelEdit = () => setEditingField(null);

  const color = (data.color as Color | undefined) ?? MISSION_COLOR;
  const from  = color.from;
  const to    = color.to;
  const border = selected ? (color.border ?? from) : '#d1d5db';

  const allEntries = Object.entries(data as Doc).filter(([k]) => !['_id', '__v', 'color', 'branchId', '_dimmed', 'onViewResults'].includes(k));
  const priorityFields = ['name', 'missionName', 'status', 'type', 'description'];
  const priorityEntries = priorityFields
    .map(k => [k, (data as Doc)[k]] as [string, unknown])
    .filter(([, v]) => v !== undefined);

  const displayName = String((data as Doc).name ?? (data as Doc).missionName ?? (data as Doc)._id ?? 'Mission');
  const copyToClipboard = (t: string) => navigator.clipboard.writeText(t);
  const onViewResults = (data as Doc).onViewResults as (() => void) | undefined;

  const renderField = (k: string, v: unknown, editable = false) => {
    if (editable && editingField === k) {
      return (
        <div className="flex-1 space-y-1">
          <input type="text" value={editKey} onChange={e => setEditKey(e.target.value)}
            className="w-full px-1 py-0.5 text-xs border rounded" style={{ borderColor: from }} placeholder="Field name" />
          <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
            className="w-full px-1 py-0.5 text-xs border rounded" style={{ borderColor: from }} placeholder="Value" />
          <div className="flex gap-1">
            <button onClick={handleSaveEdit} className="px-2 py-0.5 text-white rounded text-xs" style={{ background: from }}>Save</button>
            <button onClick={handleCancelEdit} className="px-2 py-0.5 bg-gray-400 text-white rounded text-xs">Cancel</button>
          </div>
        </div>
      );
    }
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const isObjExpanded = expandedObjects.has(k);
      const objEntries = Object.entries(v as Record<string, unknown>);
      return (
        <div className="flex-1 min-w-0">
          <button onClick={() => toggleObjectExpand(k)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${isObjExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[11px]">{'{…}'} {objEntries.length} fields</span>
          </button>
          {isObjExpanded && (
            <div className="ml-3 mt-1 space-y-0.5 border-l-2 pl-2" style={{ borderColor: from + '40' }}>
              {objEntries.map(([ek, ev]) => (
                <div key={ek} className="flex items-start gap-1 text-[11px]">
                  <span className="text-gray-500 font-medium flex-shrink-0">{ek}:</span>
                  <span className="text-gray-700 dark:text-gray-300 break-all">
                    {typeof ev === 'object' && ev !== null
                      ? JSON.stringify(ev).slice(0, 80)
                      : String(ev ?? '')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (k === 'status') {
      return (
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'active' || v === 'done' ? 'bg-green-100 text-green-700' : v === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
          {String(v)}
        </span>
      );
    }
    return renderValue(k, v, from, copyToClipboard);
  };

  return (
    <div style={{ borderColor: border }}
      className="rounded-xl border-2 shadow-lg bg-white dark:bg-gray-800 min-w-[280px] max-w-[340px] transition-all">
      <div style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        className="rounded-t-xl px-4 py-2 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-white font-bold text-sm truncate">{displayName}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onViewResults && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewResults(); }}
              className="text-white/80 hover:text-white transition-colors px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[10px] font-medium"
              title="View result_missions"
            >
              Results
            </button>
          )}
          <button onClick={() => toggleExpanded()} className="text-white/80 hover:text-white transition-colors">
            <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        <div className="text-xs font-mono break-all" style={{ color: from }}>
          {String((data as Doc)._id)}
        </div>

        {!expanded ? (
          priorityEntries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-300 w-24 flex-shrink-0 font-bold truncate">{k}</span>
              <div className="flex-1 min-w-0 text-gray-800 dark:text-gray-200">{renderField(k, v)}</div>
            </div>
          ))
        ) : (
          allEntries.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 text-xs group w-full">
              {editingField === k ? (
                <div className="flex items-start gap-1.5 w-full">{renderField(k, v, true)}</div>
              ) : (
                <div className="flex items-start gap-1.5 w-full">
                  <span
                    className="text-gray-600 dark:text-gray-300 w-24 flex-shrink-0 font-bold truncate cursor-pointer hover:text-purple-600"
                    onDoubleClick={() => handleDoubleClick(k, v)}
                    title="Double-click to edit"
                  >{k}</span>
                  <div
                    className="flex-1 min-w-0 text-gray-800 dark:text-gray-200 cursor-pointer hover:text-purple-600"
                    onDoubleClick={() => handleDoubleClick(k, v)}
                    title="Double-click to edit"
                  >{renderField(k, v)}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Handle type="target" position={Position.Left}  id="left"  className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      <Handle type="target" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      
      {/* Club-specific target handles for Mission */}
      <Handle type="target" position={Position.Left} id="club-left" 
        className="!w-3 !h-3 !border-2 !border-white connection-point club-point" 
        style={{ background: CLUB_COLOR.from }} 
        title="From club" />
      <Handle type="target" position={Position.Right} id="club-right" 
        className="!w-3 !h-3 !border-2 !border-white connection-point club-point" 
        style={{ background: CLUB_COLOR.from }} 
        title="From club" />
    </div>
  );
});

// ─── Camera Node ─────────────────────────────────────────────────────────────
const CAMERA_COLOR = { from: '#14b8a6', to: '#0d9488', border: '#14b8a6' }; // teal

const CameraNode = memo(function CameraNode({ data, selected }: NodeProps) {
  const [expanded, toggleExpanded] = useAutoCollapse(selected);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  const color = (data.color as Color | undefined) ?? CAMERA_COLOR;
  const from  = color.from;
  const to    = color.to;
  const border = selected ? (color.border ?? from) : '#d1d5db';
  const isDimmed = !!(data as Doc)._dimmed;

  const allEntries = Object.entries(data as Doc).filter(([k]) => !['_id', '__v', 'color', 'clubId', '_dimmed'].includes(k));
  const priorityFields = ['name', 'cameraName', 'status', 'ip', 'rtspUrl'];
  const priorityEntries = priorityFields
    .map(k => [k, (data as Doc)[k]] as [string, unknown])
    .filter(([, v]) => v !== undefined);

  const displayName = String((data as Doc).name ?? (data as Doc).cameraName ?? (data as Doc)._id ?? 'Camera');
  const copyToClipboard = (t: string) => navigator.clipboard.writeText(t);

  const handleDoubleClick = (key: string, value: unknown) => {
    setEditingField(key);
    setEditKey(key);
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''));
  };
  const handleSaveEdit = () => setEditingField(null);
  const handleCancelEdit = () => setEditingField(null);

  return (
    <div style={{ borderColor: border, opacity: isDimmed ? 0.35 : 1 }}
      className="rounded-xl border-2 shadow-lg bg-white dark:bg-gray-800 min-w-[320px] max-w-[380px] transition-all"
      title={isDimmed ? 'Hidden camera (dimmed preview)' : undefined}
    >
      <div style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        className="rounded-t-xl px-4 py-2 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-white font-bold text-sm truncate">{displayName}</span>
        </div>
        <button onClick={() => toggleExpanded()} className="text-white/80 hover:text-white transition-colors flex-shrink-0">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        <div className="text-xs font-mono break-all" style={{ color: from }}>
          {String((data as Doc)._id)}
        </div>

        {!expanded ? (
          priorityEntries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-300 w-24 flex-shrink-0 font-bold truncate">{k}</span>
              {k === 'status' ? (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'active' || v === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {String(v)}
                </span>
              ) : (
                <span className="font-medium text-gray-800 dark:text-gray-200 break-all">{String(v)}</span>
              )}
            </div>
          ))
        ) : (
          allEntries.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 text-xs group w-full">
              {editingField === k ? (
                <div className="flex-1 space-y-1">
                  <input type="text" value={editKey} onChange={e => setEditKey(e.target.value)}
                    className="w-full px-1 py-0.5 text-xs border rounded" style={{ borderColor: from }}
                    placeholder="Field name" />
                  <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="w-full px-1 py-0.5 text-xs border rounded" style={{ borderColor: from }}
                    placeholder="Value" />
                  <div className="flex gap-1">
                    <button onClick={handleSaveEdit} className="px-2 py-0.5 text-white rounded text-xs" style={{ background: from }}>Save</button>
                    <button onClick={handleCancelEdit} className="px-2 py-0.5 bg-gray-400 text-white rounded text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 w-full">
                  <span className="text-gray-600 dark:text-gray-300 w-24 flex-shrink-0 font-bold truncate cursor-pointer hover:text-teal-600"
                    onDoubleClick={() => handleDoubleClick(k, v)} title="Double-click to edit">{k}</span>
                  <div className="flex-1 min-w-0 cursor-pointer text-gray-800 dark:text-gray-200 hover:text-teal-600"
                    onDoubleClick={() => handleDoubleClick(k, v)} title="Double-click to edit">
                    {k === 'status' ? (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'active' || v === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {String(v)}
                      </span>
                    ) : renderValue(k, v, from, copyToClipboard)}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Handle type="target" position={Position.Left}  id="left"  className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      <Handle type="target" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      
      {/* Club-specific target handles for Camera */}
      <Handle type="target" position={Position.Left} id="club-left" 
        className="!w-3 !h-3 !border-2 !border-white connection-point club-point" 
        style={{ background: CLUB_COLOR.from }} 
        title="From club" />
      <Handle type="target" position={Position.Right} id="club-right" 
        className="!w-3 !h-3 !border-2 !border-white connection-point club-point" 
        style={{ background: CLUB_COLOR.from }} 
        title="From club" />
    </div>
  );
});

// ─── Club Node ────────────────────────────────────────────────────────────────
const ClubNode = memo(function ClubNode({ data, selected }: NodeProps) {
  const [expanded, toggleExpanded] = useAutoCollapse(selected);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  const color = (data.color as Color | undefined) ?? CLUB_COLOR;
  const from  = color.from;
  const to    = color.to;
  const border = selected ? (color.border ?? from) : '#d1d5db';

  const allEntries = Object.entries(data as Doc).filter(([k]) => !['_id', '__v', 'color'].includes(k));
  const priorityFields = ['name', 'clubName', 'workId', 'status'];
  const priorityEntries = priorityFields
    .map(k => [k, (data as Doc)[k]] as [string, unknown])
    .filter(([, v]) => v !== undefined);

  const displayName = String((data as Doc).name ?? (data as Doc).clubName ?? (data as Doc)._id ?? 'Club');
  const copyToClipboard = (t: string) => navigator.clipboard.writeText(t);

  const handleDoubleClick = (key: string, value: unknown) => {
    setEditingField(key);
    setEditKey(key);
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''));
  };
  const handleSaveEdit = () => setEditingField(null);
  const handleCancelEdit = () => setEditingField(null);

  return (
    <div style={{ borderColor: border }}
      className="rounded-xl border-2 shadow-lg bg-white dark:bg-gray-800 min-w-[220px] max-w-[280px] transition-all">
      <div style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        className="rounded-t-xl px-4 py-2 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-white font-bold text-sm truncate">{displayName}</span>
        </div>
        <button onClick={() => toggleExpanded()} className="text-white/80 hover:text-white transition-colors flex-shrink-0">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        <div className="text-xs font-mono break-all" style={{ color: from }}>
          {String((data as Doc)._id)}
        </div>

        {!expanded ? (
          priorityEntries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-300 w-20 flex-shrink-0 font-bold">{k}</span>
              {k === 'status' ? (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {String(v)}
                </span>
              ) : (
                <span className="font-medium text-gray-800 dark:text-gray-200 break-all">{String(v)}</span>
              )}
            </div>
          ))
        ) : (
          allEntries.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 text-xs group w-full">
              {editingField === k ? (
                <div className="flex-1 space-y-1">
                  <input type="text" value={editKey} onChange={e => setEditKey(e.target.value)}
                    className="w-full px-1 py-0.5 text-xs border rounded" style={{ borderColor: from }}
                    placeholder="Field name" />
                  <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="w-full px-1 py-0.5 text-xs border rounded" style={{ borderColor: from }}
                    placeholder="Value" />
                  <div className="flex gap-1">
                    <button onClick={handleSaveEdit} className="px-2 py-0.5 text-white rounded text-xs" style={{ background: from }}>Save</button>
                    <button onClick={handleCancelEdit} className="px-2 py-0.5 bg-gray-400 text-white rounded text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 w-full">
                  <span className="text-gray-600 dark:text-gray-300 w-20 flex-shrink-0 font-bold cursor-pointer hover:text-blue-600"
                    onDoubleClick={() => handleDoubleClick(k, v)} title="Double-click to edit">{k}</span>
                  <div className="flex-1 min-w-0 cursor-pointer text-gray-800 dark:text-gray-200 hover:text-blue-600"
                    onDoubleClick={() => handleDoubleClick(k, v)} title="Double-click to edit">
                    {k === 'status' ? (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {String(v)}
                      </span>
                    ) : renderValue(k, v, from, copyToClipboard)}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      <Handle type="source" position={Position.Left}  id="left"  className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      
      {/* Collection-specific handles for better visual separation */}
      <Handle type="source" position={Position.Right} id="worker-right" 
        className="!w-3 !h-3 !border-2 !border-white connection-point worker-point" 
        style={{ background: WORKER_COLOR.from, top: '25%' }} 
        title="Worker connection" />
      <Handle type="source" position={Position.Right} id="camera-right" 
        className="!w-3 !h-3 !border-2 !border-white connection-point camera-point" 
        style={{ background: CAMERA_COLOR.from, top: '50%' }} 
        title="Camera connection" />
      <Handle type="source" position={Position.Right} id="mission-right" 
        className="!w-3 !h-3 !border-2 !border-white connection-point mission-point" 
        style={{ background: MISSION_COLOR.from, top: '75%' }} 
        title="Mission connection" />
      
      <Handle type="source" position={Position.Left} id="worker-left" 
        className="!w-3 !h-3 !border-2 !border-white connection-point worker-point" 
        style={{ background: WORKER_COLOR.from, top: '25%' }} 
        title="Worker connection" />
      <Handle type="source" position={Position.Left} id="camera-left" 
        className="!w-3 !h-3 !border-2 !border-white connection-point camera-point" 
        style={{ background: CAMERA_COLOR.from, top: '50%' }} 
        title="Camera connection" />
      <Handle type="source" position={Position.Left} id="mission-left" 
        className="!w-3 !h-3 !border-2 !border-white connection-point mission-point" 
        style={{ background: MISSION_COLOR.from, top: '75%' }} 
        title="Mission connection" />
    </div>
  );
});

// ─── Worker Node ──────────────────────────────────────────────────────────────
const WorkerNode = memo(function WorkerNode({ data, selected }: NodeProps) {
  const [expanded, toggleExpanded] = useAutoCollapse(selected);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  const color = (data.color as Color | undefined) ?? WORKER_COLOR;
  const from  = color.from;
  const to    = color.to;
  const border = selected ? (color.border ?? from) : '#d1d5db';

  const allEntries = Object.entries(data as Doc).filter(([k]) => !['_id', '__v', 'color'].includes(k));
  const priorityFields = ['hostName', 'status', 'publicIP', 'cpu'];
  const priorityEntries = priorityFields
    .map(k => [k, (data as Doc)[k]] as [string, unknown])
    .filter(([, v]) => v !== undefined);

  const displayName = String((data as Doc).hostName ?? (data as Doc).name ?? (data as Doc).workerName ?? (data as Doc)._id ?? 'Worker');
  const copyToClipboard = (t: string) => navigator.clipboard.writeText(t);

  const handleDoubleClick = (key: string, value: unknown) => {
    setEditingField(key);
    setEditKey(key);
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''));
  };
  const handleSaveEdit = () => setEditingField(null);
  const handleCancelEdit = () => setEditingField(null);

  return (
    <div style={{ borderColor: border }}
      className="rounded-xl border-2 shadow-lg bg-white dark:bg-gray-800 min-w-[220px] max-w-[280px] transition-all">
      <div style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        className="rounded-t-xl px-4 py-2 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-white font-bold text-sm truncate">{displayName}</span>
        </div>
        <button onClick={() => toggleExpanded()} className="text-white/80 hover:text-white transition-colors flex-shrink-0">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        <div className="text-xs font-mono break-all" style={{ color: from }}>
          {String((data as Doc)._id)}
        </div>

        {!expanded ? (
          priorityEntries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-300 w-20 flex-shrink-0 font-bold">{k}</span>
              {k === 'status' ? (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  v === 'idle' ? 'bg-green-100 text-green-700' :
                  v === 'busy' ? 'bg-yellow-100 text-yellow-700' :
                  v === 'offline' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'}`}>
                  {String(v)}
                </span>
              ) : (
                <span className="font-medium text-gray-800 dark:text-gray-200 break-all">{String(v)}</span>
              )}
            </div>
          ))
        ) : (
          allEntries.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 text-xs group w-full">
              {editingField === k ? (
                <div className="flex-1 space-y-1">
                  <input type="text" value={editKey} onChange={e => setEditKey(e.target.value)}
                    className="w-full px-1 py-0.5 text-xs border rounded" style={{ borderColor: from }}
                    placeholder="Field name" />
                  <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="w-full px-1 py-0.5 text-xs border rounded" style={{ borderColor: from }}
                    placeholder="Value" />
                  <div className="flex gap-1">
                    <button onClick={handleSaveEdit} className="px-2 py-0.5 text-white rounded text-xs" style={{ background: from }}>Save</button>
                    <button onClick={handleCancelEdit} className="px-2 py-0.5 bg-gray-400 text-white rounded text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 w-full">
                  <span className="text-gray-600 dark:text-gray-300 w-20 flex-shrink-0 font-bold cursor-pointer hover:text-orange-500"
                    onDoubleClick={() => handleDoubleClick(k, v)} title="Double-click to edit">{k}</span>
                  <div className="flex-1 min-w-0 cursor-pointer text-gray-800 dark:text-gray-200 hover:text-orange-500"
                    onDoubleClick={() => handleDoubleClick(k, v)} title="Double-click to edit">
                    {k === 'status' ? (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        v === 'idle' ? 'bg-green-100 text-green-700' :
                        v === 'busy' ? 'bg-yellow-100 text-yellow-700' :
                        v === 'offline' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'}`}>
                        {String(v)}
                      </span>
                    ) : renderValue(k, v, from, copyToClipboard)}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Handle type="target" position={Position.Left}  id="left"  className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      <Handle type="target" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      
      {/* Club-specific target handles for Worker */}
      <Handle type="target" position={Position.Left} id="club-left" 
        className="!w-3 !h-3 !border-2 !border-white connection-point club-point" 
        style={{ background: CLUB_COLOR.from }} 
        title="From club" />
      <Handle type="target" position={Position.Right} id="club-right" 
        className="!w-3 !h-3 !border-2 !border-white connection-point club-point" 
        style={{ background: CLUB_COLOR.from }} 
        title="From club" />
    </div>
  );
});

// nodeTypes defined OUTSIDE component to prevent ReactFlow from re-registering on every render
const nodeTypes = { clubNode: ClubNode, workerNode: WorkerNode, cameraNode: CameraNode, missionNode: MissionNode, annotationNode: AnnotationNode };


function loadSavedPositions(connId: string, db: string): Record<string, { x: number; y: number; color?: Color }> {
  // Use new service
  const positions = statePersistenceService.loadNodePositions(connId, db);
  const colors = statePersistenceService.loadNodeColors(connId, db);
  
  console.log('[ClubBoard] loadSavedPositions:', { connId, db, positionCount: Object.keys(positions).length, positions });
  
  const result: Record<string, { x: number; y: number; color?: Color }> = {};
  Object.keys(positions).forEach(id => {
    result[id] = { ...positions[id], color: colors[id] as unknown as Color | undefined };
  });
  return result;
}

function savePositions(nodes: Node[], connId: string, db: string) {
  // Use new service with debouncing
  console.log('[ClubBoard] savePositions called:', { connId, db, nodeCount: nodes.length });
  statePersistenceService.saveNodePositions(nodes, connId, db);
  statePersistenceService.saveNodeColors(nodes, connId, db);
}

// ─── Result Missions Panel ────────────────────────────────────────────────────
interface ResultMissionsPanelProps {
  missionName: string;
  missionId: string;
  results: Doc[];
  loading: boolean;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  onClose: () => void;
}

function ResultMissionsPanel({ missionName, missionId, results, loading, filters, onFilterChange, onClearFilters, onClose }: ResultMissionsPanelProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ── Date range filter (client-side on createdAt) ──────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(todayStr);

  // Collect all unique filter-able keys from results (exclude _id, __v, clubMissionId, createdAt)
  const filterKeys = useMemo(() => {
    const keys = new Set<string>();
    results.forEach(r => Object.keys(r).forEach(k => {
      if (!['_id', '__v', 'clubMissionId', 'createdAt'].includes(k)) keys.add(k);
    }));
    return [...keys].slice(0, 8); // cap at 8 filter fields
  }, [results]);

  // Apply active filters + date range
  const filtered = useMemo(() => {
    return results.filter(r => {
      // Date range filter on createdAt
      if (dateFrom || dateTo) {
        const raw = r.createdAt;
        if (raw) {
          const d = new Date(String(raw));
          if (!isNaN(d.getTime())) {
            const dayStr = d.toISOString().slice(0, 10);
            if (dateFrom && dayStr < dateFrom) return false;
            if (dateTo && dayStr > dateTo) return false;
          }
        }
      }
      // Text filters
      return Object.entries(filters).every(([k, v]) => {
        if (!v) return true;
        const val = String(r[k] ?? '').toLowerCase();
        return val.includes(v.toLowerCase());
      });
    });
  }, [results, filters, dateFrom, dateTo]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="absolute right-0 top-0 h-full w-[480px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col z-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-violet-700 flex items-center justify-between flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-white font-bold text-sm truncate">result_missions</span>
          </div>
          <p className="text-purple-200 text-[11px] truncate mt-0.5">{missionName} · {missionId}</p>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors ml-2 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Date range + Filters */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0 space-y-2">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">Date</span>
          <div className="flex items-center gap-1 flex-1">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 px-2 py-1 text-[11px] border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 outline-none focus:border-purple-400"
              title="From date"
            />
            <span className="text-[11px] text-gray-400 flex-shrink-0">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 px-2 py-1 text-[11px] border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 outline-none focus:border-purple-400"
              title="To date"
            />
            {(dateFrom || dateTo !== todayStr) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(todayStr); }}
                className="text-[10px] text-purple-600 hover:text-purple-800 font-medium flex-shrink-0 px-1"
                title="Reset date range"
              >✕</button>
            )}
          </div>
        </div>

        {/* Text filters */}
        {filterKeys.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Filters</span>
              {activeFilterCount > 0 && (
                <button onClick={onClearFilters} className="text-[10px] text-purple-600 hover:text-purple-800 font-medium">
                  Clear all ({activeFilterCount})
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {filterKeys.map(k => (
                <div key={k} className="flex flex-col gap-0.5">
                  <label className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">{k}</label>
                  <input
                    type="text"
                    value={filters[k] ?? ''}
                    onChange={e => onFilterChange(k, e.target.value)}
                    placeholder={`Filter ${k}…`}
                    className={`px-2 py-1 text-[11px] border rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 outline-none transition-colors ${
                      filters[k] ? 'border-purple-400 ring-1 ring-purple-300' : 'border-gray-200 dark:border-gray-600 focus:border-purple-400'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Count bar */}
      <div className="px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-shrink-0">
        {loading ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-500" />
            Loading…
          </div>
        ) : (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-200">{filtered.length}</span>
            {filtered.length !== results.length && <span> / {results.length}</span>} results
          </span>
        )}
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {!loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
            <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            No results found
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((r, idx) => {
              const rid = String(r._id ?? idx);
              const isExpanded = expandedRow === rid;
              const entries = Object.entries(r).filter(([k]) => !['_id', '__v', 'clubMissionId'].includes(k));
              const preview = entries.slice(0, 3);
              return (
                <div key={rid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <button
                    className="w-full text-left px-4 py-2.5 flex items-start gap-2"
                    onClick={() => setExpandedRow(isExpanded ? null : rid)}
                  >
                    <svg className={`w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate mb-1">{rid}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {preview.map(([k, v]) => (
                          <span key={k} className="text-[11px] text-gray-600 dark:text-gray-300">
                            <span className="font-medium">{k}:</span>{' '}
                            <span className="text-gray-800 dark:text-gray-100">{String(v).slice(0, 30)}{String(v).length > 30 ? '…' : ''}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-8 pb-3 space-y-1">
                      <div className="text-[10px] font-mono text-gray-400 mb-1">_id: {rid}</div>
                      {entries.map(([k, v]) => (
                        <div key={k} className="flex items-start gap-2 text-xs">
                          <span className="text-gray-500 dark:text-gray-400 w-28 flex-shrink-0 font-medium truncate">{k}</span>
                          <span className="text-gray-800 dark:text-gray-200 break-all flex-1">
                            {Array.isArray(v) ? `[${(v as unknown[]).length} items]` : typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 80) : String(v ?? '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mission node builder ─────────────────────────────────────────────────────
function buildMissionNodesFromData(
  allMissions: Doc[],
  clubNodes: Node[],
  limitPerClub: Record<string, number>,
  saved: Record<string, { x: number; y: number; color?: Color }>,
  onViewResults?: (missionId: string, missionName: string) => void
): Node[] {
  const result: Node[] = [];
  clubNodes.forEach(club => {
    const matched = allMissions.filter(m => {
      const branchIds = m.branchIds;
      if (Array.isArray(branchIds)) {
        return branchIds.some(bid => String(bid) === String(club.data.branchId ?? ''));
      }
      return false;
    });
    const limit = limitPerClub[club.id] ?? 10;
    matched.slice(0, limit).forEach((m, i) => {
      const id = `mission-${String(m._id)}`;
      const pos = saved[id] ?? { x: club.position.x - 420, y: club.position.y + i * 160 };
      const missionName = String(m.name ?? m.missionName ?? m._id ?? 'Mission');
      const missionId = String(m._id);
      result.push({
        id, type: 'missionNode', position: { x: pos.x, y: pos.y },
        data: {
          ...m,
          color: pos.color,
          onViewResults: onViewResults ? () => onViewResults(missionId, missionName) : undefined,
        },
      });
    });
  });
  return result;
}

// ─── ClubBoardInner ───────────────────────────────────────────────────────────
interface ClubBoardProps {
  connectionId: string;
  database: string;
  clubs: Doc[];
}

function ClubBoardInner({ connectionId, database, clubs }: ClubBoardProps) {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  // Always replace edges (never accumulate) — prevents duplicate edges on re-render
  const setEdgesDeduped = useCallback((newEdges: Edge[]) => {
    const seen = new Set<string>();
    setEdges(newEdges.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }));
  }, [setEdges]);
  const [loading, setLoading] = useState(false);
  const [colorPicker, setColorPicker] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const workerIdFieldRef = useRef<string>('workId');
  // ── Camera visibility ─────────────────────────────────────────────────────
  const [hiddenCameraIds, setHiddenCameraIds] = useState<Set<string>>(() => {
    // Load saved camera visibility on mount
    const saved = statePersistenceService.loadCameraVisibility(connectionId, database);
    return new Set(saved.hiddenIds);
  });
  const [showHiddenCameras, setShowHiddenCameras] = useState(() => {
    // Load saved showDimmed preference
    const saved = statePersistenceService.loadCameraVisibility(connectionId, database);
    return saved.showDimmed;
  });
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [missionsMenuOpen, setMissionsMenuOpen] = useState(false);
  
  // ── Result Missions Panel ─────────────────────────────────────────────────
  const [resultPanel, setResultPanel] = useState<{
    missionId: string;
    missionName: string;
    results: Doc[];
    loading: boolean;
  } | null>(null);
  const [resultFilters, setResultFilters] = useState<Record<string, string>>({});

  const openResultMissions = useCallback(async (missionId: string, missionName: string) => {
    setResultPanel({ missionId, missionName, results: [], loading: true });
    setResultFilters({});
    try {
      const res = await apiClient.get(
        `/connections/${connectionId}/databases/${database}/collections/result_missions/documents?pageSize=5000`
      );
      const json = res.data;
      const all: Doc[] = json.success ? json.data.documents : [];
      const matched = all
        .filter(r => String(r.clubMissionId ?? '') === missionId)
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
          const tb = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
          return tb - ta; // mới nhất lên đầu
        });
      setResultPanel({ missionId, missionName, results: matched, loading: false });
    } catch (err) {
      console.error('[ClubBoard] result_missions fetch error:', err);
      setResultPanel(prev => prev ? { ...prev, loading: false } : null);
    }
  }, [connectionId, database]);
  
  // Save camera visibility whenever it changes
  useEffect(() => {
    statePersistenceService.saveCameraVisibility(hiddenCameraIds, showHiddenCameras, connectionId, database);
  }, [hiddenCameraIds, showHiddenCameras, connectionId, database]);
  // ── Missions ──────────────────────────────────────────────────────────────
  // allMissions: full list fetched from server (keyed by clubId/branchId)
  const allMissionsRef = useRef<Doc[]>([]);
  // how many missions to show per club
  const [missionLimitPerClub, setMissionLimitPerClub] = useState<Record<string, number>>(() => {
    // Load saved mission limits on mount
    return statePersistenceService.loadMissionLimits(connectionId, database);
  });
  
  // Save mission limits whenever they change
  useEffect(() => {
    if (Object.keys(missionLimitPerClub).length > 0) {
      statePersistenceService.saveMissionLimits(missionLimitPerClub, connectionId, database);
    }
  }, [missionLimitPerClub, connectionId, database]);

  // Keep ref to openResultMissions so mission nodes always have latest callback
  const openResultMissionsRef = useRef(openResultMissions);
  openResultMissionsRef.current = openResultMissions;
  // Looks for fields named workId, workerID, workerId, worker_id, etc.
  const detectWorkerIdField = useCallback((clubDocs: Doc[]): string => {
    if (!clubDocs.length) return 'workId';
    const candidates = ['workId', 'workerID', 'workerId', 'worker_id', 'workid', 'WorkerId', 'WorkerID'];
    const firstClub = clubDocs[0];
    for (const field of candidates) {
      if (firstClub[field] !== undefined) return field;
    }
    // Fallback: find any field that looks like an ID reference to workers
    const keys = Object.keys(firstClub);
    const found = keys.find(k => k.toLowerCase().includes('worker') || k.toLowerCase() === 'workid');
    return found ?? 'workId';
  }, []);

  // Build edges: club → worker + club → camera + club → mission
  const buildEdges = useCallback((allNodes: Node[], idField: string): Edge[] => {
    const clubNodes    = allNodes.filter(n => n.type === 'clubNode');
    const workerNodes  = allNodes.filter(n => n.type === 'workerNode');
    const cameraNodes  = allNodes.filter(n => n.type === 'cameraNode');
    const missionNodes = allNodes.filter(n => n.type === 'missionNode' && !n.hidden);

    const workerEdges: Edge[] = clubNodes.flatMap(club => {
      const wid = String(club.data[idField] ?? '');
      if (!wid) return [];
      const worker = workerNodes.find(w => String(w.data._id) === wid);
      if (!worker) return [];
      const clubIsLeft = club.position.x < worker.position.x;
      return [{
        id: `edge-${club.id}-${worker.id}`,
        source: club.id, target: worker.id,
        sourceHandle: clubIsLeft ? 'worker-right' : 'worker-left',
        targetHandle: clubIsLeft ? 'club-left' : 'club-right',
        type: 'smoothstep', animated: false,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
        label: idField,
        labelStyle: { fill: '#3b82f6', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#eff6ff' },
      } as Edge];
    });

    const cameraEdges: Edge[] = cameraNodes.flatMap(cam => {
      const cid = String(cam.data.clubId ?? '');
      if (!cid) return [];
      const club = clubNodes.find(c => String(c.data._id) === cid);
      if (!club) return [];
      const camIsRight = cam.position.x > club.position.x;
      return [{
        id: `edge-${club.id}-${cam.id}`,
        source: club.id, target: cam.id,
        sourceHandle: camIsRight ? 'camera-right' : 'camera-left',
        targetHandle: camIsRight ? 'club-left' : 'club-right',
        type: 'smoothstep', animated: false,
        style: { stroke: '#14b8a6', strokeWidth: 1.5, strokeDasharray: '5,3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#14b8a6' },
        label: 'clubId',
        labelStyle: { fill: '#14b8a6', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#f0fdfa' },
      } as Edge];
    });

    const missionEdges: Edge[] = missionNodes.flatMap(mission => {
      // branchIds is an array — find the club whose _id is in that array
      const branchIds: unknown[] = Array.isArray(mission.data.branchIds)
        ? mission.data.branchIds
        : [];
      const club = clubNodes.find(c =>
        branchIds.some(bid => String(bid) === String(c.data.branchId ?? ''))
      );
      if (!club) return [];
      const missionIsRight = mission.position.x > club.position.x;
      return [{
        id: `edge-${club.id}-${mission.id}`,
        source: club.id, target: mission.id,
        sourceHandle: missionIsRight ? 'mission-right' : 'mission-left',
        targetHandle: missionIsRight ? 'club-left' : 'club-right',
        type: 'smoothstep', animated: false,
        style: { stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '4,3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
        label: 'branchIds',
        labelStyle: { fill: '#8b5cf6', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#f5f3ff' },
      } as Edge];
    });

    // Dedup by edge ID — prevents duplicate edges when buildEdges is called multiple times
    const all = [...workerEdges, ...cameraEdges, ...missionEdges];
    const seen = new Set<string>();
    return all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
  }, []);

  // Load workers for all unique workIds in clubs
  useEffect(() => {
    if (!clubs.length) return;

    const idField = detectWorkerIdField(clubs);
    workerIdFieldRef.current = idField;

    const workIds = [...new Set(clubs.map(c => c[idField]).filter(Boolean).map(String))];
    console.log('[ClubBoard] detected field:', idField, '| workIds:', workIds);

    const saved = loadSavedPositions(connectionId, database);

    const clubNodes: Node[] = clubs.map((c, i) => {
      const id = `club-${String(c._id)}`;
      const pos = saved[id] ?? { x: 60, y: 60 + i * 180 };
      return { id, type: 'clubNode', position: { x: pos.x, y: pos.y }, data: { ...c, color: pos.color } };
    });

    if (!workIds.length) {
      console.warn('[ClubBoard] No workIds found in clubs — will still fetch workers & cameras.');
    }

    setLoading(true);
    Promise.all([
      apiClient.get(`/connections/${connectionId}/databases/${database}/collections/workers/documents?pageSize=500`).then(r => r.data),
      apiClient.get(`/connections/${connectionId}/databases/${database}/collections/cameras/documents?pageSize=500`).then(r => r.data),
      apiClient.get(`/connections/${connectionId}/databases/${database}/collections/clubs_missions/documents?pageSize=1000`).then(r => r.data),
    ])
      .then(([workerResult, cameraResult, missionResult]) => {
        const allWorkers: Doc[]  = workerResult.success  ? workerResult.data.documents  : [];
        const allCameras: Doc[]  = cameraResult.success  ? cameraResult.data.documents  : [];
        const allMissions: Doc[] = missionResult.success ? missionResult.data.documents : [];
        allMissionsRef.current = allMissions;

        // Debug: log first mission and first club to verify field names
        if (allMissions.length > 0) {
          console.log('[ClubBoard] Sample mission keys:', Object.keys(allMissions[0]));
          console.log('[ClubBoard] Sample mission:', JSON.stringify(allMissions[0]).slice(0, 300));
        } else {
          console.warn('[ClubBoard] No missions fetched — check collection name "clubs_missions"');
        }
        if (clubs.length > 0) {
          console.log('[ClubBoard] Sample club keys:', Object.keys(clubs[0]));
          console.log('[ClubBoard] Sample club _id:', String(clubs[0]._id));
        }

        const workerNodes: Node[] = allWorkers.map((w, i) => {
          const id = `worker-${String(w._id)}`;
          const pos = saved[id] ?? { x: 500, y: 60 + i * 180 };
          return { id, type: 'workerNode', position: { x: pos.x, y: pos.y }, data: { ...w, color: pos.color } };
        });

        const cameraNodes: Node[] = allCameras.map((cam, i) => {
          const id = `camera-${String(cam._id)}`;
          const pos = saved[id] ?? { x: 900, y: 60 + i * 160 };
          return { id, type: 'cameraNode', position: { x: pos.x, y: pos.y }, data: { ...cam, color: pos.color } };
        });

        // Restore saved mission limits, fallback to 10 for new clubs
        const savedLimits = statePersistenceService.loadMissionLimits(connectionId, database);
        const mergedLimits: Record<string, number> = {};
        clubNodes.forEach(c => { mergedLimits[c.id] = savedLimits[c.id] ?? 10; });
        setMissionLimitPerClub(mergedLimits);

        const missionNodes = buildMissionNodesFromData(allMissions, clubNodes, mergedLimits, saved, (id, name) => openResultMissionsRef.current(id, name));

        const allNodes = [...clubNodes, ...workerNodes, ...cameraNodes, ...missionNodes];
        const loadedAnnotations = loadAnnotations(connectionId, database, 'club-board');
        setNodes([...allNodes, ...loadedAnnotations]);
        setEdgesDeduped(buildEdges(allNodes, idField));
      })
      .catch(err => {
        console.error('[ClubBoard] fetch error:', err);
        const loadedAnnotations = loadAnnotations(connectionId, database, 'club-board');
        setNodes([...clubNodes, ...loadedAnnotations]);
        setEdges([]);
      })
      .finally(() => setLoading(false));
  }, [clubs, connectionId, database]);

  const handleDragStop: NodeDragHandler = useCallback((_e, _node, allNodes) => {
    console.log('[ClubBoard] handleDragStop:', { draggedNodeCount: allNodes.length });
    // allNodes from ReactFlow only contains rendered (non-hidden) nodes.
    // Merge with full nodes state so hidden camera positions are preserved too.
    setNodes(currentNodes => {
      const posMap = new Map(allNodes.map(n => [n.id, n.position]));
      const merged = currentNodes.map(n => posMap.has(n.id) ? { ...n, position: posMap.get(n.id)! } : n);
      console.log('[ClubBoard] merged nodes:', { totalCount: merged.length });
      savePositions(merged, connectionId, database);
      saveAnnotations(merged, connectionId, database, 'club-board');
      // Rebuild edges once after drag ends (not every frame)
      setEdgesDeduped(buildEdges(merged, workerIdFieldRef.current));
      return merged;
    });
  }, [connectionId, database, buildEdges, setEdgesDeduped]);

  // Only pass through node changes — do NOT rebuild edges on every position change (causes lag)
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setColorPicker({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const applyColor = useCallback((color: Color | typeof COLOR_PRESETS[0]) => {
    if (!colorPicker) return;
    setNodes(nds => {
      const updated = nds.map(n => n.id === colorPicker.nodeId ? { ...n, data: { ...n.data, color } } : n);
      savePositions(updated, connectionId, database);
      saveAnnotations(updated, connectionId, database, 'club-board');
      return updated;
    });
  }, [colorPicker, connectionId, database]);

  // ── Update workerId in DB ─────────────────────────────────────────────────
  const updateClubWorker = useCallback(async (clubId: string, workerId: string | null) => {
    const idField = workerIdFieldRef.current;
    const clubDocId = clubId.replace('club-', '');
    await apiClient.put(
      `/connections/${connectionId}/databases/${database}/collections/clubs/documents/${clubDocId}`,
      { [idField]: workerId }
    );
    // Update node data locally
    setNodes(nds => nds.map(n =>
      n.id === clubId ? { ...n, data: { ...n.data, [idField]: workerId } } : n
    ));
  }, [connectionId, database]);

  // ── Drag-to-connect: club handle → worker handle ──────────────────────────
  const handleConnect = useCallback((connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target) return;

    // Determine which is club and which is worker
    const clubId   = source.startsWith('club-')   ? source : target.startsWith('club-')   ? target : null;
    const workerId = source.startsWith('worker-') ? source : target.startsWith('worker-') ? target : null;
    if (!clubId || !workerId) return;

    const workerDocId = workerId.replace('worker-', '');
    updateClubWorker(clubId, workerDocId);

    // Add edge immediately (will be rebuilt on next nodesChange too)
    setNodes(nds => {
      const updated = nds.map(n =>
        n.id === clubId ? { ...n, data: { ...n.data, [workerIdFieldRef.current]: workerDocId } } : n
      );
      setEdgesDeduped(buildEdges(updated, workerIdFieldRef.current));
      return updated;
    });
  }, [updateClubWorker, buildEdges, setEdgesDeduped]);

  // ── Delete edge → set workerId to null ────────────────────────────────────
  const handleEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach(edge => {
      const clubId = edge.source.startsWith('club-') ? edge.source : edge.target;
      updateClubWorker(clubId, null);
      setNodes(nds => {
        const updated = nds.map(n =>
          n.id === clubId ? { ...n, data: { ...n.data, [workerIdFieldRef.current]: null } } : n
        );
        setEdgesDeduped(buildEdges(updated, workerIdFieldRef.current));
        return updated;
      });
    });
  }, [updateClubWorker, buildEdges, setEdgesDeduped]);

  // ── Annotation callback refs — always current without triggering re-renders ──
  const handleDeleteAnnotationRef = useRef<(nodeId: string) => void>(() => {});
  const handleSaveAnnotationRef   = useRef<(nodeId: string, content: string) => void>(() => {});
  const handleResizeAnnotationRef = useRef<(nodeId: string, w: number, h: number) => void>(() => {});

  const handleDeleteAnnotation = useCallback((nodeId: string) => {
    setNodes(nds => {
      const updated = nds.filter(n => n.id !== nodeId);
      saveAnnotations(updated, connectionId, database, 'club-board');
      return updated;
    });
  }, [connectionId, database]);

  const handleSaveAnnotation = useCallback((nodeId: string, content: string) => {
    setNodes(nds => {
      const updated = nds.map(n => {
        if (n.id === nodeId && n.type === 'annotationNode') {
          return { ...n, data: { ...n.data, content, updatedAt: new Date().toISOString() } };
        }
        return n;
      });
      saveAnnotations(updated, connectionId, database, 'club-board');
      return updated;
    });
  }, [connectionId, database]);

  const handleResizeAnnotation = useCallback((nodeId: string, width: number, height: number) => {
    setNodes(nds => {
      const updated = nds.map(n => {
        if (n.id === nodeId && n.type === 'annotationNode') {
          return { ...n, data: { ...n.data, width, height, updatedAt: new Date().toISOString() } };
        }
        return n;
      });
      saveAnnotations(updated, connectionId, database, 'club-board');
      return updated;
    });
  }, [connectionId, database]);

  // Keep refs in sync — no re-render triggered
  handleDeleteAnnotationRef.current = handleDeleteAnnotation;
  handleSaveAnnotationRef.current   = handleSaveAnnotation;
  handleResizeAnnotationRef.current = handleResizeAnnotation;

  const handleAddAnnotation = useCallback(() => {
    const viewport = reactFlowInstance.getViewport();
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

    const now = new Date().toISOString();
    const annotationId = uuidv4();

    const newAnnotation: Node = {
      id: `annotation-${annotationId}`,
      type: 'annotationNode',
      position: { x: centerX - 100, y: centerY - 50 },
      data: {
        id: annotationId,
        content: 'New annotation',
        color: COLOR_PRESETS[0],
        width: 200,
        height: 100,
        createdAt: now,
        updatedAt: now,
        onDelete: (id: string) => handleDeleteAnnotationRef.current(id),
        onSave: (id: string, c: string) => handleSaveAnnotationRef.current(id, c),
        onResize: (id: string, w: number, h: number) => handleResizeAnnotationRef.current(id, w, h),
      },
    };

    setNodes(nds => {
      const updated = [...nds, newAnnotation];
      saveAnnotations(updated, connectionId, database, 'club-board');
      return updated;
    });

    setTimeout(() => {
      const element = document.querySelector(`[data-id="${newAnnotation.id}"]`);
      if (element) {
        const event = new MouseEvent('dblclick', { bubbles: true });
        element.dispatchEvent(event);
      }
    }, 100);
  }, [reactFlowInstance, connectionId, database]);

  // ── Camera visibility helpers ─────────────────────────────────────────────
  const allCameraNodes = useMemo(() => nodes.filter(n => n.type === 'cameraNode'), [nodes]);
  const annotationCount = useMemo(() => nodes.filter(n => n.type === 'annotationNode').length, [nodes]);

  // ── Mission load-more ─────────────────────────────────────────────────────
  const loadMoreMissions = useCallback((clubNodeId: string) => {
    const saved = loadSavedPositions(connectionId, database);
    setMissionLimitPerClub(prev => {
      const newLimit = (prev[clubNodeId] ?? 10) + 5;
      const newLimits = { ...prev, [clubNodeId]: newLimit };
      // Rebuild mission nodes with new limit
      setNodes(nds => {
        const clubNodes   = nds.filter(n => n.type === 'clubNode');
        const nonMission  = nds.filter(n => n.type !== 'missionNode');
        const newMissions = buildMissionNodesFromData(allMissionsRef.current, clubNodes, newLimits, saved, (id, name) => openResultMissionsRef.current(id, name));
        const updated = [...nonMission, ...newMissions];
        setEdgesDeduped(buildEdges(updated, workerIdFieldRef.current));
        return updated;
      });
      return newLimits;
    });
  }, [connectionId, database, buildEdges, setEdgesDeduped]);

  const toggleCamera = useCallback((cameraId: string) => {    setHiddenCameraIds(prev => {
      const next = new Set(prev);
      if (next.has(cameraId)) next.delete(cameraId);
      else next.add(cameraId);
      return next;
    });
  }, []);

  const hideAllCameras = useCallback(() => {
    setHiddenCameraIds(new Set(allCameraNodes.map(n => n.id)));
  }, [allCameraNodes]);

  const showAllCameras = useCallback(() => {
    setHiddenCameraIds(new Set());
  }, []);

  // Apply hidden state: use ReactFlow's `hidden` prop so nodes stay in state
  const displayNodes = useMemo(() => nodes.map(n => {
    if (n.type !== 'cameraNode') return n;
    const isHidden = hiddenCameraIds.has(n.id);
    if (showHiddenCameras) return { ...n, hidden: false, data: { ...n.data, _dimmed: isHidden } };
    return { ...n, hidden: isHidden, data: { ...n.data, _dimmed: false } };
  }), [nodes, hiddenCameraIds, showHiddenCameras]);

  const displayEdges = useMemo(() => edges.map(e => {
    const isCameraEdge = e.target.startsWith('camera-');
    if (!isCameraEdge) return e;
    const isHidden = hiddenCameraIds.has(e.target);
    if (showHiddenCameras) return { ...e, hidden: false, style: { ...e.style, opacity: isHidden ? 0.25 : 1 } };
    return { ...e, hidden: isHidden };
  }), [edges, hiddenCameraIds, showHiddenCameras]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2 flex-wrap">
        {/* Title + legend */}
        <div className="flex items-center gap-2 mr-1">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Club Board</span>
        </div>

        {/* Legend dots */}
        <div className="flex items-center gap-2 text-[11px] text-gray-500 border-l border-gray-200 dark:border-gray-700 pl-2 mr-1">
          {[
            { label: 'clubs', from: '#3b82f6', to: '#2563eb' },
            { label: 'workers', from: '#f97316', to: '#ea580c' },
            { label: 'cameras', from: '#14b8a6', to: '#0d9488' },
            { label: 'missions', from: '#8b5cf6', to: '#7c3aed' },
          ].map(({ label, from, to }) => (
            <span key={label} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: `linear-gradient(135deg,${from},${to})` }} />
              {label}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex items-center gap-2">
          {/* ── Camera visibility button ── */}
          <div className="relative">
            <button
              onClick={() => setCameraMenuOpen(o => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                hiddenCameraIds.size > 0
                  ? 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              title="Manage camera visibility"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Cameras
              {hiddenCameraIds.size > 0 && (
                <span className="bg-teal-600 text-white rounded-full px-1.5 text-[10px] font-bold leading-4">
                  {hiddenCameraIds.size}
                </span>
              )}
              <svg className={`w-3 h-3 transition-transform ${cameraMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {cameraMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCameraMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-64 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {allCameraNodes.length} cameras
                    </span>
                    <div className="flex gap-1">
                      <button onClick={showAllCameras} className="px-2 py-0.5 text-[10px] bg-teal-50 hover:bg-teal-100 text-teal-700 rounded font-medium transition-colors">
                        Show all
                      </button>
                      <button onClick={hideAllCameras} className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-medium transition-colors">
                        Hide all
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-300">Show hidden (dimmed)</span>
                    <button
                      onClick={() => setShowHiddenCameras(v => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${showHiddenCameras ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showHiddenCameras ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {allCameraNodes.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-gray-400 text-center">No cameras loaded</p>
                    ) : (
                      allCameraNodes.map(cam => {
                        const isHidden = hiddenCameraIds.has(cam.id);
                        const name = String(cam.data.name ?? cam.data.cameraName ?? cam.data._id ?? cam.id);
                        return (
                          <div
                            key={cam.id}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => toggleCamera(cam.id)}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isHidden ? 'border-gray-300 bg-white dark:bg-gray-800' : 'border-teal-500 bg-teal-500'}`}>
                              {!isHidden && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-xs truncate flex-1 ${isHidden ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                              {name}
                            </span>
                            {isHidden ? (
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Missions load-more button ── */}
          {(() => {
            const clubNodesForMenu = nodes.filter(n => n.type === 'clubNode');
            const totalMissions = nodes.filter(n => n.type === 'missionNode').length;
            if (!clubNodesForMenu.length) return null;
            return (
              <div className="relative">
                <button
                  onClick={() => setMissionsMenuOpen(o => !o)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                  title="Load more missions per club"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Missions
                  <span className="bg-purple-500 text-white rounded-full px-1.5 text-[10px] font-bold leading-4">
                    {totalMissions}
                  </span>
                </button>
                {missionsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMissionsMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-72 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Load more missions per club</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {clubNodesForMenu.map(club => {
                      const clubName = String(club.data.name ?? club.data.clubName ?? club.data._id);
                      const total = allMissionsRef.current.filter(m => {
                        const bids = Array.isArray(m.branchIds) ? m.branchIds : [];
                        return bids.some((bid: unknown) => String(bid) === String(club.data.branchId ?? ''));
                      }).length;
                      const showing = missionLimitPerClub[club.id] ?? 10;
                      const canLoadMore = showing < total;
                      return (
                        <div key={club.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{clubName}</p>
                            <p className="text-[10px] text-gray-400">{Math.min(showing, total)} / {total} missions</p>
                          </div>
                          {canLoadMore ? (
                            <button
                              onClick={() => loadMoreMissions(club.id)}
                              className="flex-shrink-0 px-2 py-1 text-[10px] font-medium text-white bg-purple-500 hover:bg-purple-600 rounded transition-colors"
                            >
                              +5 more
                            </button>
                          ) : (
                            <span className="flex-shrink-0 text-[10px] text-gray-400">all loaded</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Export/Import/Reset buttons */}
          <button
            onClick={() => {
              const exported = statePersistenceService.exportState(connectionId, database);
              const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `clubboard-${connectionId}-${database}-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 transition-colors"
            title="Export workspace state"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>

          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const data = JSON.parse(ev.target?.result as string);
                    const result = statePersistenceService.importState(data, connectionId, database);
                    if (result.success) {
                      alert('State imported successfully! Reloading...');
                      window.location.reload();
                    } else {
                      alert(`Import failed: ${result.error}`);
                    }
                  } catch (error) {
                    alert(`Import failed: ${(error as Error).message}`);
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
            title="Import workspace state"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>

          <button
            onClick={() => {
              if (confirm('Reset layout to default? This will clear all saved positions, colors, and settings for this workspace.')) {
                statePersistenceService.clearState(connectionId, database);
                window.location.reload();
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
            title="Reset layout to default"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />

          <button
            onClick={handleAddAnnotation}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 transition-colors"
            title="Add annotation box"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Annotation
            {annotationCount > 0 && (
              <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full px-1.5 text-[10px] font-bold leading-4">
                {annotationCount}
              </span>
            )}
          </button>
        </div>

        {/* Right side: loading + hint */}
        <div className="ml-auto flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" />
              Loading…
            </div>
          )}
          <span className="text-[11px] text-gray-400 dark:text-gray-500 hidden sm:block">
            Right-click = color · Drag = move
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleDragStop}
          onNodeContextMenu={handleNodeContextMenu}
          onConnect={handleConnect}
          onEdgesDelete={handleEdgesDelete}
          deleteKeyCode="Delete"
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          panOnDrag={[1, 2]}
          multiSelectionKeyCode="Control"
          selectionOnDrag={true}
          selectionMode={'partial' as any}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
          <Controls />
          <MiniMap
            nodeColor={(n) => n.data?.color?.from ?? (n.type === 'clubNode' ? '#3b82f6' : n.type === 'cameraNode' ? '#14b8a6' : '#f97316')}
            maskColor="rgba(0,0,0,0.05)"
            className="!bg-white dark:!bg-gray-800 !border !border-gray-200"
          />
        </ReactFlow>

        {colorPicker && (
          <ColorPicker
            x={colorPicker.x}
            y={colorPicker.y}
            nodeId={colorPicker.nodeId}
            onPick={applyColor}
            onClose={() => setColorPicker(null)}
          />
        )}

        {/* Result Missions Panel */}
        {resultPanel && (
          <ResultMissionsPanel
            missionId={resultPanel.missionId}
            missionName={resultPanel.missionName}
            results={resultPanel.results}
            loading={resultPanel.loading}
            filters={resultFilters}
            onFilterChange={(k, v) => setResultFilters(prev => ({ ...prev, [k]: v }))}
            onClearFilters={() => setResultFilters({})}
            onClose={() => setResultPanel(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Export with Provider ─────────────────────────────────────────────────────
export function ClubBoard(props: ClubBoardProps) {
  return (
    <ReactFlowProvider>
      <ClubBoardInner {...props} />
    </ReactFlowProvider>
  );
}
