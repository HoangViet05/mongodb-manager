import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  BackgroundVariant, Handle, Position, NodeProps,
  NodeDragHandler, useReactFlow, ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';

interface Doc { [key: string]: unknown; }

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = [
  { label: 'Green',  from: '#10b981', to: '#059669', border: '#10b981' },
  { label: 'Purple', from: '#8b5cf6', to: '#7c3aed', border: '#8b5cf6' },
  { label: 'Blue',   from: '#3b82f6', to: '#2563eb', border: '#3b82f6' },
  { label: 'Orange', from: '#f97316', to: '#ea580c', border: '#f97316' },
  { label: 'Red',    from: '#ef4444', to: '#dc2626', border: '#ef4444' },
  { label: 'Pink',   from: '#ec4899', to: '#db2777', border: '#ec4899' },
  { label: 'Teal',   from: '#14b8a6', to: '#0d9488', border: '#14b8a6' },
  { label: 'Yellow', from: '#eab308', to: '#ca8a04', border: '#eab308' },
];

// Import annotation color presets
import { COLOR_PRESETS } from '../../types/annotations';
import { AnnotationNode } from './AnnotationNode';
import { saveAnnotations, loadAnnotations } from '../../utils/annotationStorage';

// ─── Color Picker Popup ───────────────────────────────────────────────────────
function ColorPicker({ x, y, nodeId, onPick, onClose }: {
  x: number; 
  y: number;
  nodeId: string;
  onPick: (color: typeof COLORS[0] | typeof COLOR_PRESETS[0]) => void;
  onClose: () => void;
}) {
  // Determine if this is an annotation node
  const isAnnotationNode = nodeId.startsWith('annotation-');
  const colors = isAnnotationNode ? COLOR_PRESETS : COLORS;
  
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3"
        style={{ left: x, top: y }}
      >
        <p className="text-xs font-semibold text-gray-500 mb-2">Pick color</p>
        <div className="grid grid-cols-4 gap-1.5">
          {colors.map(c => {
            // Render gradient for user/pattern nodes, solid for annotation nodes
            const bgStyle = isAnnotationNode 
              ? { background: (c as typeof COLOR_PRESETS[0]).background }
              : { background: `linear-gradient(135deg, ${(c as typeof COLORS[0]).from}, ${(c as typeof COLORS[0]).to})` };
            
            return (
              <button
                key={c.label}
                title={c.label}
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

// ─── Custom Node: User ────────────────────────────────────────────────────────
function UserNode({ data, selected }: NodeProps) {
  const [expanded, toggleExpanded] = useAutoCollapse(selected);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [expandedArrays, setExpandedArrays] = useState<Set<string>>(new Set());
  
  const color = data.color as typeof COLORS[0] | undefined;
  const from  = color?.from  ?? '#10b981';
  const to    = color?.to    ?? '#059669';
  const border = selected ? (color?.border ?? '#10b981') : '#d1d5db';

  // Get all fields except _id, __v, color, onExpandChange
  const allEntries = Object.entries(data as Doc).filter(([k]) => !['_id', '__v', 'color', 'onExpandChange'].includes(k));
  const priorityFields = ['userName', 'phone', 'externalId', 'status'];
  const priorityEntries = priorityFields
    .map(k => [k, (data as Doc)[k]] as [string, unknown])
    .filter(([, v]) => v !== undefined);
  const _otherEntries = allEntries.filter(([k]) => !priorityFields.includes(k));

  const handleDoubleClick = (key: string, value: unknown) => {
    setEditingField(key);
    setEditKey(key);
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value));
  };

  const handleSaveEdit = () => {
    console.log('Save edit:', { oldKey: editingField, newKey: editKey, newValue: editValue });
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    console.log('Copied:', text);
  };

  const toggleArray = (key: string) => {
    setExpandedArrays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderValue = (key: string, value: unknown) => {
    // URL fields - clickable to copy
    if ((key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) && typeof value === 'string') {
      return (
        <button
          onClick={() => copyToClipboard(value)}
          className="text-blue-600 dark:text-blue-400 hover:underline text-left break-all"
          title="Click to copy"
        >
          {value}
        </button>
      );
    }

    // Arrays - expandable with vertical JSON layout
    if (Array.isArray(value)) {
      const isExpanded = expandedArrays.has(key);
      return (
        <div className="flex flex-col gap-1 w-full">
          <button
            onClick={() => toggleArray(key)}
            className="text-gray-700 dark:text-gray-300 hover:text-green-600 flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            [{value.length} items]
          </button>
          {isExpanded && (
            <div className="ml-3 space-y-1 text-xs">
              {value.map((item, i) => {
                const itemKey = `${key}-${i}`;
                const isItemExpanded = expandedArrays.has(itemKey);
                
                // If item is object with "number" field, show just the number
                if (typeof item === 'object' && item !== null && 'number' in item) {
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <button
                        onClick={() => toggleArray(itemKey)}
                        className="text-green-600 dark:text-green-400 hover:text-green-700 flex items-center gap-1 font-mono"
                      >
                        <svg className={`w-2.5 h-2.5 transition-transform ${isItemExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {String((item as any).number)}
                      </button>
                      {isItemExpanded && (
                        <pre className="ml-4 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-[10px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all">
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                }
                
                // Default: show full item
                return (
                  <div key={i} className="text-gray-600 dark:text-gray-400">
                    <div className="text-green-600 dark:text-green-400">{i}:</div>
                    {typeof item === 'object' ? (
                      <pre className="ml-2 whitespace-pre-wrap break-all text-[10px]">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    ) : (
                      <div className="ml-2">{String(item)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Default rendering
    if (value === null) return <span className="text-gray-400">null</span>;
    if (typeof value === 'object') return <span className="text-gray-500">{'{…}'}</span>;
    return <span className="break-all">{String(value)}</span>;
  };

  return (
    <div style={{ borderColor: border }}
      className="rounded-xl border-2 shadow-lg bg-white dark:bg-gray-800 min-w-[220px] max-w-[280px] transition-all">
      <div style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        className="rounded-t-xl px-4 py-2 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-white font-bold text-sm truncate">{data.userName || 'Unknown'}</span>
        </div>
        <button onClick={() => toggleExpanded()} className="text-white/80 hover:text-white transition-colors flex-shrink-0">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {/* Priority fields (always visible) */}
        {!expanded && priorityEntries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="text-gray-600 dark:text-gray-300 w-20 flex-shrink-0 font-bold">{k}</span>
            {k === 'status' ? (
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {String(v) || '—'}
              </span>
            ) : k === 'externalId' ? (
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400 truncate">{String(v)}</span>
            ) : (
              <span className="font-medium text-gray-800 dark:text-gray-200 break-all">{String(v)}</span>
            )}
          </div>
        ))}

        {/* All fields (when expanded) */}
        {expanded && allEntries.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 text-xs group w-full">
            {editingField === k ? (
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={editKey}
                  onChange={(e) => setEditKey(e.target.value)}
                  className="w-full px-1 py-0.5 text-xs border border-green-400 rounded"
                  placeholder="Field name"
                />
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-1 py-0.5 text-xs border border-green-400 rounded"
                  placeholder="Value"
                />
                <div className="flex gap-1">
                  <button onClick={handleSaveEdit} className="px-2 py-0.5 bg-green-500 text-white rounded text-xs">Save</button>
                  <button onClick={handleCancelEdit} className="px-2 py-0.5 bg-gray-400 text-white rounded text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 w-full">
                <span
                  className="text-gray-600 dark:text-gray-300 w-20 flex-shrink-0 cursor-pointer hover:text-green-600 font-bold"
                  onDoubleClick={() => handleDoubleClick(k, v)}
                  title="Double-click to edit"
                >
                  {k}
                </span>
                <div
                  className="flex-1 min-w-0 cursor-pointer hover:text-green-600 text-gray-800 dark:text-gray-200"
                  onDoubleClick={() => handleDoubleClick(k, v)}
                  title="Double-click to edit"
                >
                  {k === 'status' ? (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {String(v) || '—'}
                    </span>
                  ) : (
                    renderValue(k, v)
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      <Handle type="source" position={Position.Left}  id="left"  className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
    </div>
  );
}

// ─── Custom Node: UserPattern ─────────────────────────────────────────────────
function PatternNode({ data, selected }: NodeProps) {
  const [expanded, toggleExpanded] = useAutoCollapse(selected);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [expandedArrays, setExpandedArrays] = useState<Set<string>>(new Set());
  
  const color = data.color as typeof COLORS[0] | undefined;
  const from  = color?.from  ?? '#8b5cf6';
  const to    = color?.to    ?? '#7c3aed';
  const entries = Object.entries(data.doc as Doc).filter(([k]) => !['_id', '__v', 'externalId', 'onExpandChange'].includes(k));

  const handleDoubleClick = (key: string, value: unknown) => {
    setEditingField(key);
    setEditKey(key);
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value));
  };

  const handleSaveEdit = () => {
    // TODO: Call API to update document
    console.log('Save edit:', { oldKey: editingField, newKey: editKey, newValue: editValue });
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Show toast notification
    console.log('Copied:', text);
  };

  const toggleArray = (key: string) => {
    setExpandedArrays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderValue = (key: string, value: unknown) => {
    // imgUrl - clickable to copy
    if (key === 'imgUrl' && typeof value === 'string') {
      return (
        <button
          onClick={() => copyToClipboard(value)}
          className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[120px] text-left"
          title="Click to copy"
        >
          {value.slice(0, 25)}...
        </button>
      );
    }

    // Arrays - expandable with vertical JSON layout
    if (Array.isArray(value)) {
      const isExpanded = expandedArrays.has(key);
      return (
        <div className="flex flex-col gap-1 w-full">
          <button
            onClick={() => toggleArray(key)}
            className="text-gray-700 dark:text-gray-300 hover:text-purple-600 flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            [{value.length} items]
          </button>
          {isExpanded && (
            <div className="ml-3 space-y-1 text-xs">
              {value.map((item, i) => {
                const itemKey = `${key}-${i}`;
                const isItemExpanded = expandedArrays.has(itemKey);
                
                // If item is object with "number" field, show just the number
                if (typeof item === 'object' && item !== null && 'number' in item) {
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <button
                        onClick={() => toggleArray(itemKey)}
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1 font-mono"
                      >
                        <svg className={`w-2.5 h-2.5 transition-transform ${isItemExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {String((item as any).number)}
                      </button>
                      {isItemExpanded && (
                        <pre className="ml-4 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-[10px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all">
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                }
                
                // Default: show full item
                return (
                  <div key={i} className="text-gray-600 dark:text-gray-400">
                    <div className="text-purple-600 dark:text-purple-400">{i}:</div>
                    {typeof item === 'object' ? (
                      <pre className="ml-2 whitespace-pre-wrap break-all text-[10px]">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    ) : (
                      <div className="ml-2">{String(item)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Default rendering
    if (value === null) return <span className="text-gray-400">null</span>;
    if (typeof value === 'object') return <span className="text-gray-500">{'{…}'}</span>;
    return <span className="truncate max-w-[120px]">{String(value).slice(0, 25)}</span>;
  };

  return (
    <div style={{ borderColor: color?.border ?? '#a78bfa' }}
      className="rounded-xl border-2 shadow-lg bg-white dark:bg-gray-800 min-w-[200px] max-w-[280px]">
      <div style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        className="rounded-t-xl px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-white font-bold text-xs">user_pattern</span>
        </div>
        <button onClick={() => toggleExpanded()} className="text-white/80 hover:text-white transition-colors">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div className="px-3 py-2 space-y-1">
        {/* Full ID */}
        <div className="text-xs font-mono break-all" style={{ color: from }}>
          {String((data.doc as Doc)._id)}
        </div>
        
        {/* externalId */}
        <div className="flex items-center gap-1.5 text-xs rounded px-2 py-1" style={{ background: `${from}18` }}>
          <span className="w-16 flex-shrink-0 font-bold" style={{ color: from }}>externalId</span>
          <span className="font-mono truncate" style={{ color: to }}>{String((data.doc as Doc).externalId)}</span>
        </div>
        
        {/* Other fields */}
        {expanded && entries.slice(0, 10).map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 text-xs group w-full">
            {editingField === k ? (
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={editKey}
                  onChange={(e) => setEditKey(e.target.value)}
                  className="w-full px-1 py-0.5 text-xs border border-purple-400 rounded"
                  placeholder="Field name"
                />
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-1 py-0.5 text-xs border border-purple-400 rounded"
                  placeholder="Value"
                />
                <div className="flex gap-1">
                  <button onClick={handleSaveEdit} className="px-2 py-0.5 bg-green-500 text-white rounded text-xs">Save</button>
                  <button onClick={handleCancelEdit} className="px-2 py-0.5 bg-gray-400 text-white rounded text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 w-full">
                <span
                  className="text-gray-600 dark:text-gray-300 w-16 flex-shrink-0 truncate cursor-pointer hover:text-purple-600 font-bold"
                  onDoubleClick={() => handleDoubleClick(k, v)}
                  title="Double-click to edit"
                >
                  {k}
                </span>
                <div
                  className="flex-1 min-w-0 cursor-pointer hover:text-purple-600"
                  onDoubleClick={() => handleDoubleClick(k, v)}
                  title="Double-click to edit"
                >
                  {renderValue(k, v)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <Handle type="target" position={Position.Left}  id="left"  className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
      <Handle type="target" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white" style={{ background: from }} />
    </div>
  );
}

const nodeTypes = { userNode: UserNode, patternNode: PatternNode, annotationNode: AnnotationNode };

interface RelationBoardProps {
  connectionId: string;
  database: string;
  users: Doc[];
}

const storageKey = (connId: string, db: string) => `relation-board:${connId}:${db}`;

function RelationBoardInner({ connectionId, database, users }: RelationBoardProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [colorPicker, setColorPicker] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const reactFlowInstance = useReactFlow();

  // ── Persist helpers ──────────────────────────────────────────────────────
  const savePositions = useCallback((nds: Node[]) => {
    const key = storageKey(connectionId, database);
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
    })();
    nds.forEach(n => {
      existing[n.id] = { x: n.position.x, y: n.position.y, color: n.data.color };
    });
    localStorage.setItem(key, JSON.stringify(existing));
  }, [connectionId, database]);

  const loadSaved = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey(connectionId, database));
      return raw ? JSON.parse(raw) as Record<string, { x: number; y: number; color?: typeof COLORS[0] }> : {};
    } catch { return {}; }
  }, [connectionId, database]);

  // ── Auto-layout helpers ──────────────────────────────────────────────────
  // REMOVED: Auto-layout caused bugs with ReactFlow state management
  // Users can manually drag nodes to avoid overlaps

  // ── Build edges ──────────────────────────────────────────────────────────
  const buildEdges = useCallback((allNodes: Node[], userId: string) => {
    const userNode = allNodes.find(n => n.id === `user-${userId}`);
    if (!userNode) return [];
    return allNodes.filter(n => n.type === 'patternNode').map(p => {
      const patternIsLeft = p.position.x < userNode.position.x;
      return {
        id: `edge-${userId}-${p.id}`,
        source: `user-${userId}`,
        target: p.id,
        sourceHandle: patternIsLeft ? 'left' : 'right',
        targetHandle: patternIsLeft ? 'right' : 'left',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
        label: 'externalId',
        labelStyle: { fill: '#8b5cf6', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#f5f3ff' },
      } as Edge;
    });
  }, []);

  // ── Init user nodes (restore saved positions) ────────────────────────────
  useEffect(() => {
    const saved = loadSaved();
    const userNodes: Node[] = users.map((u, i) => {
      const id = `user-${String(u._id)}`;
      const pos = saved[id] ?? { x: 60, y: 60 + i * 160 };
      return { 
        id, 
        type: 'userNode', 
        position: { x: pos.x, y: pos.y }, 
        data: { 
          ...u, 
          color: pos.color
        } 
      };
    });
    
    // Task 8.3: Load annotations from localStorage when component mounts
    const loadedAnnotations = loadAnnotations(connectionId, database, 'relation-board');
    
    setNodes([...userNodes, ...loadedAnnotations]);
    setEdges([]);
    setSelectedUserId(null);
  }, [users, connectionId, database]);

  // ── Reload patterns when status filter changes ────────────────────────────
  useEffect(() => {
    if (!selectedUserId) return;
    
    const reloadPatterns = async () => {
      const userNode = nodes.find(n => n.id === `user-${selectedUserId}`);
      if (!userNode) return;
      
      setLoadingPatterns(true);
      const externalId = userNode.data.externalId;
      
      try {
        const filter: Record<string, unknown> = { externalId };
        if (statusFilter !== 'all') {
          filter.status = statusFilter;
        }
        
        const res = await fetch(
          `http://localhost:3001/api/connections/${connectionId}/databases/${database}/collections/user_patterns/documents?filter=${encodeURIComponent(JSON.stringify(filter))}&pageSize=50`
        );
        const result = await res.json();
        const patterns: Doc[] = result.success ? result.data.documents : [];
        const saved = loadSaved();

        setNodes(nds => {
          const userNodes = nds.filter(n => n.type === 'userNode');
          const patternNodes: Node[] = patterns.map((p, i) => {
            const id = `pattern-${String(p._id)}`;
            const pos = saved[id] ?? {
              x: userNode.position.x + 380,
              y: userNode.position.y - ((patterns.length - 1) * 200) + i * 400,
            };
            return { 
              id, 
              type: 'patternNode', 
              position: { x: pos.x, y: pos.y }, 
              data: { 
                doc: p, 
                color: pos.color
              } 
            };
          });
          const allNodes = [...userNodes, ...patternNodes];
          setEdges(buildEdges(allNodes, selectedUserId));
          return allNodes;
        });
      } finally {
        setLoadingPatterns(false);
      }
    };
    
    reloadPatterns();
  }, [statusFilter]);

  // ── Drag stop → save ─────────────────────────────────────────────────────
  const handleDragStop: NodeDragHandler = useCallback((_e, _node, allNodes) => {
    savePositions(allNodes);
    // Save annotations after drag
    saveAnnotations(allNodes, connectionId, database, 'relation-board');
    if (selectedUserId) setEdges(buildEdges(allNodes, selectedUserId));
  }, [selectedUserId, buildEdges, savePositions, connectionId, database]);

  // ── Node changes (for edge recompute during drag) ─────────────────────────
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    if (selectedUserId) {
      setNodes(nds => {
        const updated = nds.map(n => {
          const c = changes.find((ch) => 'id' in ch && ch.id === n.id);
          if (c && 'position' in c && c.position) return { ...n, position: c.position };
          return n;
        });
        setEdges(buildEdges(updated, selectedUserId));
        return updated;
      });
    }
  }, [selectedUserId, buildEdges, onNodesChange]);

  // ── Click user → load patterns ────────────────────────────────────────────
  const handleNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
    if (!node.id.startsWith('user-')) return;
    const userId = node.id.replace('user-', '');

    if (selectedUserId === userId) {
      // Save pattern positions before removing
      setNodes(nds => {
        savePositions(nds);
        return nds.filter(n => n.type === 'userNode').map(n => ({ ...n, selected: false }));
      });
      setEdges([]);
      setSelectedUserId(null);
      return;
    }

    setSelectedUserId(userId);
    setLoadingPatterns(true);

    // Save current pattern positions before switching user
    setNodes(nds => {
      savePositions(nds);
      return nds.map(n => ({ ...n, selected: n.id === node.id }));
    });

    const externalId = node.data.externalId;
    try {
      // Build filter: always include externalId, optionally add status
      const filter: Record<string, unknown> = { externalId };
      if (statusFilter !== 'all') {
        filter.status = statusFilter;
      }
      
      const res = await fetch(
        `http://localhost:3001/api/connections/${connectionId}/databases/${database}/collections/user_patterns/documents?filter=${encodeURIComponent(JSON.stringify(filter))}&pageSize=50`
      );
      const result = await res.json();
      const patterns: Doc[] = result.success ? result.data.documents : [];
      const saved = loadSaved();

      setNodes(nds => {
        const userNodes = nds.filter(n => n.type === 'userNode');
        const patternNodes: Node[] = patterns.map((p, i) => {
          const id = `pattern-${String(p._id)}`;
          const pos = saved[id] ?? {
            x: node.position.x + 380,
            y: node.position.y - ((patterns.length - 1) * 200) + i * 400,
          };
          return { 
            id, 
            type: 'patternNode', 
            position: { x: pos.x, y: pos.y }, 
            data: { 
              doc: p, 
              color: pos.color
            } 
          };
        });
        const allNodes = [...userNodes, ...patternNodes];
        setEdges(buildEdges(allNodes, userId));
        return allNodes;
      });
    } finally {
      setLoadingPatterns(false);
    }
  }, [selectedUserId, connectionId, database, buildEdges, loadSaved, savePositions, statusFilter]);

  // ── Right-click → color picker ────────────────────────────────────────────
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setColorPicker({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const applyColor = useCallback((color: typeof COLORS[0] | typeof COLOR_PRESETS[0]) => {
    if (!colorPicker) return;
    setNodes(nds => {
      const updated = nds.map(n =>
        n.id === colorPicker.nodeId ? { ...n, data: { ...n.data, color } } : n
      );
      savePositions(updated);
      return updated;
    });
  }, [colorPicker, savePositions]);

  // ── Delete annotation handler ─────────────────────────────────────────────
  const handleDeleteAnnotation = useCallback((nodeId: string) => {
    setNodes(nds => {
      const updated = nds.filter(n => n.id !== nodeId);
      // Save annotations to localStorage after deletion
      saveAnnotations(updated, connectionId, database, 'relation-board');
      return updated;
    });
  }, [connectionId, database]);

  // ── Save annotation content handler ───────────────────────────────────────
  const handleSaveAnnotation = useCallback((nodeId: string, content: string) => {
    setNodes(nds => {
      const updated = nds.map(n => {
        if (n.id === nodeId && n.type === 'annotationNode') {
          return {
            ...n,
            data: {
              ...n.data,
              content,
              updatedAt: new Date().toISOString(),
            },
          };
        }
        return n;
      });
      saveAnnotations(updated, connectionId, database, 'relation-board');
      return updated;
    });
  }, [connectionId, database]);

  // ── Resize annotation handler ─────────────────────────────────────────────
  const handleResizeAnnotation = useCallback((nodeId: string, width: number, height: number) => {
    setNodes(nds => {
      const updated = nds.map(n => {
        if (n.id === nodeId && n.type === 'annotationNode') {
          return {
            ...n,
            data: {
              ...n.data,
              width,
              height,
              updatedAt: new Date().toISOString(),
            },
          };
        }
        return n;
      });
      saveAnnotations(updated, connectionId, database, 'relation-board');
      return updated;
    });
  }, [connectionId, database]);

  // ── Task 8.2: Add annotation handler ──────────────────────────────────────
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
        color: COLOR_PRESETS[0], // Yellow default
        width: 200,
        height: 100,
        createdAt: now,
        updatedAt: now,
        onDelete: handleDeleteAnnotation,
      },
    };
    
    setNodes(nds => {
      const updated = [...nds, newAnnotation];
      saveAnnotations(updated, connectionId, database, 'relation-board');
      return updated;
    });
    
    // Auto-enter edit mode by triggering double-click after a short delay
    setTimeout(() => {
      const element = document.querySelector(`[data-id="${newAnnotation.id}"]`);
      if (element) {
        const event = new MouseEvent('dblclick', { bubbles: true });
        element.dispatchEvent(event);
      }
    }, 100);
  }, [reactFlowInstance, connectionId, database, handleDeleteAnnotation]);

  // ── Ensure annotation nodes have callbacks ────────────────────────────────
  useEffect(() => {
    setNodes(nds => 
      nds.map(n => {
        if (n.type === 'annotationNode') {
          const needsUpdate = !n.data.onDelete || !n.data.onSave || !n.data.onResize;
          if (needsUpdate) {
            return {
              ...n,
              data: {
                ...n.data,
                onDelete: handleDeleteAnnotation,
                onSave: handleSaveAnnotation,
                onResize: handleResizeAnnotation,
              },
            };
          }
        }
        return n;
      })
    );
  }, [handleDeleteAnnotation, handleSaveAnnotation, handleResizeAnnotation]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Relation Board
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-r from-green-500 to-emerald-600 inline-block" />users</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-r from-purple-500 to-violet-600 inline-block" />user_patterns</span>
          </div>
          
          {/* Task 8.2: Add Annotation Button */}
          <button
            onClick={handleAddAnnotation}
            className="ml-2 px-3 py-1.5 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors flex items-center gap-1.5"
            title="Add annotation box"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Annotation
          </button>
          
          {/* Task 8.4: Annotation Counter */}
          <span className="text-xs text-gray-500 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded border border-yellow-200 dark:border-yellow-800">
            {nodes.filter(n => n.type === 'annotationNode').length} annotations
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Pattern status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {loadingPatterns && (
              <div className="flex items-center gap-1.5">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-purple-600" />
                Loading…
              </div>
            )}
            <span className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Click = patterns • Right-click = color</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleDragStop}
          onNodeContextMenu={handleNodeContextMenu}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          multiSelectionKeyCode="Control"
          selectionOnDrag={true}
          selectionMode={'partial' as any}
          panOnDrag={[1, 2]}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
          <Controls />
          <MiniMap
            nodeColor={(n) => n.data?.color?.from ?? (n.type === 'userNode' ? '#10b981' : '#8b5cf6')}
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
      </div>
    </div>
  );
}

export function RelationBoard(props: RelationBoardProps) {
  return (
    <ReactFlowProvider>
      <RelationBoardInner {...props} />
    </ReactFlowProvider>
  );
}
