import { useState, useEffect } from 'react';
import { RelationBoard } from './RelationBoard';
import { ClubBoard } from './ClubBoard';
import { useCardAnimations } from './useCardAnimations';
import apiClient from '../../api/apiClient';

/**
 * Scrolls to keep an expanded card visible when it extends below the viewport
 * 
 * @param cardElement - The card DOM element that was expanded
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
function scrollToExpandedCard(cardElement: HTMLDivElement): void {
  // Get the card's bounding rectangle
  const cardRect = cardElement.getBoundingClientRect();
  
  // Check if card extends below the viewport
  const viewportHeight = window.innerHeight;
  const cardBottom = cardRect.bottom;
  
  // Requirement 7.2: If card is fully visible, don't adjust scroll
  if (cardBottom <= viewportHeight && cardRect.top >= 0) {
    return;
  }
  
  // Requirement 7.1: If card extends below viewport, scroll to keep it visible
  // Requirement 7.4: If expanded content is larger than viewport, show top of card
  cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

interface Doc {
  [key: string]: unknown;
}

interface DocumentViewerProps {
  connectionId: string;
  database: string;
  collection: string;
}

async function fetchDocuments(
  connectionId: string,
  database: string,
  collection: string,
  page: number,
  pageSize: number,
  filter?: Record<string, unknown>,
  sort?: Record<string, 1 | -1>
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter) params.set('filter', JSON.stringify(filter));
  if (sort) params.set('sort', JSON.stringify(sort));
  const res = await apiClient.get(
    `/connections/${connectionId}/databases/${database}/collections/${collection}/documents?${params}`
  );
  return res.data.success ? res.data.data : { documents: [], total: 0 };
}

function DocCard({
  doc,
  index,
  isSelected,
  onClick,
  priorityFields,
  cardRef,
  positionOffset,
}: {
  doc: Doc;
  index: number;
  isSelected: boolean;
  onClick?: () => void;
  priorityFields?: string[];
  cardRef?: React.RefObject<HTMLDivElement>;
  positionOffset?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  // Scroll management: when card expands, scroll to keep it visible
  // Requirement 7.1, 7.2, 7.3, 7.4
  useEffect(() => {
    // Only scroll when expanding (not when collapsing - Requirement 7.3)
    if (expanded && cardRef?.current) {
      // Small delay to allow the card to render its expanded content
      // This ensures accurate height measurements for scrollIntoView
      const timeoutId = setTimeout(() => {
        if (cardRef.current) {
          scrollToExpandedCard(cardRef.current);
        }
      }, 50); // Small delay after expansion animation starts
      
      return () => clearTimeout(timeoutId);
    }
  }, [expanded, cardRef]);

  // Build summary fields: priority fields first, then others (skip _id, __v)
  const allFields = Object.entries(doc).filter(([k]) => k !== '_id' && k !== '__v');
  const priority = priorityFields ?? [];
  const priorityEntries = priority
    .map(k => [k, doc[k]] as [string, unknown])
    .filter(([, v]) => v !== undefined);
  const otherEntries = allFields.filter(([k]) => !priority.includes(k));
  const summaryEntries = [...priorityEntries, ...otherEntries].slice(0, 6);

  return (
    <div
      ref={cardRef}
      className={`card-animated rounded-xl border-2 transition-all shadow-sm p-4 cursor-pointer
        ${isSelected
          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-lg'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-400 hover:shadow-md'
        }`}
      style={{ transform: `translateY(${positionOffset ?? 0}px)` }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {index}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-xs">
            {String(doc._id)}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="text-gray-400 hover:text-green-600 transition-colors ml-2 flex-shrink-0"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Summary row */}
      {!expanded && (
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

      {/* Full JSON */}
      {expanded && (
        <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto border border-gray-200 dark:border-gray-700 mt-2">
          <code className="text-gray-800 dark:text-gray-200">{JSON.stringify(doc, null, 2)}</code>
        </pre>
      )}
    </div>
  );
}

function PaginationBar({
  page, totalPages, total, pageSize,
  onPrev, onNext,
}: {
  page: number; totalPages: number; total: number; pageSize: number;
  onPrev: () => void; onNext: () => void;
}) {
  if (total <= pageSize) return null;
  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
      <span className="text-sm text-gray-500">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={page === 1}
          className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all">
          ← Prev
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">
          {page} / {totalPages}
        </span>
        <button onClick={onNext} disabled={page === totalPages}
          className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all">
          Next →
        </button>
      </div>
    </div>
  );
}

export function DocumentViewer({ connectionId, database, collection }: DocumentViewerProps) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  // Animation system for main panel cards
  const { cardRefs: mainCardRefs, positionOffsets: mainPositionOffsets } = useCardAnimations(docs.length);

  // Related panel state
  const [selectedUser, setSelectedUser] = useState<Doc | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<Doc[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedTotal, setRelatedTotal] = useState(0);
  const [relatedPage, setRelatedPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Animation system for related panel cards (independent from main panel)
  const { cardRefs: relatedCardRefs, positionOffsets: relatedPositionOffsets } = useCardAnimations(relatedDocs.length);

  const isUsersCollection = collection === 'users';
  const isClubsCollection = collection === 'clubs';

  useEffect(() => {
    setPage(1);
    setSelectedUser(null);
    setRelatedDocs([]);
    setStatusFilter('all');
  }, [collection]);

  useEffect(() => {
    load();
  }, [connectionId, database, collection, page]);

  useEffect(() => {
    if (selectedUser) loadRelated(selectedUser, relatedPage);
  }, [relatedPage, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments(connectionId, database, collection, page, pageSize);
      setDocs(data.documents);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  const loadRelated = async (user: Doc, rPage = 1) => {
    const externalId = user.externalId;
    if (!externalId) return;
    setRelatedLoading(true);
    try {
      // Build filter: always include externalId, optionally add status
      const filter: Record<string, unknown> = { externalId };
      if (statusFilter !== 'all') {
        filter.status = statusFilter;
      }
      
      const data = await fetchDocuments(
        connectionId, database, 'user_patterns', rPage, 20,
        filter,
        { createdAt: -1 } // Sort by createdAt descending (newest first)
      );
      setRelatedDocs(data.documents);
      setRelatedTotal(data.total);
    } finally {
      setRelatedLoading(false);
    }
  };

  const handleUserClick = (user: Doc) => {
    if (selectedUser && String(selectedUser._id) === String(user._id)) {
      setSelectedUser(null);
      setRelatedDocs([]);
      setStatusFilter('all');
      return;
    }
    setSelectedUser(user);
    setRelatedPage(1);
    setStatusFilter('all');
    loadRelated(user, 1);
  };

  const totalPages = Math.ceil(total / pageSize);
  const relatedTotalPages = Math.ceil(relatedTotal / 20);

  return (
    <div className="flex h-full">
      {/* Main panel */}
      <div className={`flex flex-col transition-all duration-300 ${selectedUser && viewMode === 'list' ? 'w-1/2' : 'w-full'}`}>
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {collection}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{database} • {total} documents</p>
          </div>
          <div className="flex items-center gap-2">
            {(isUsersCollection || isClubsCollection) && (
              <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${viewMode === 'board' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Board
                </button>
              </div>
            )}
            <button onClick={load}
              className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Board view */}
        {viewMode === 'board' && isUsersCollection ? (
          <div className="flex-1">
            <RelationBoard
              connectionId={connectionId}
              database={database}
              users={docs}
            />
          </div>
        ) : viewMode === 'board' && isClubsCollection ? (
          <div className="flex-1">
            <ClubBoard
              connectionId={connectionId}
              database={database}
              clubs={docs}
            />
          </div>
        ) : (
        <>
        {/* Docs */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No documents found</div>
          ) : (
            <div className="space-y-3">
              {isUsersCollection && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Click a user to view their patterns
                </p>
              )}
              {docs.map((doc, i) => (
                <DocCard
                  key={String(doc._id)}
                  doc={doc}
                  index={(page - 1) * pageSize + i + 1}
                  isSelected={isUsersCollection && selectedUser ? String(selectedUser._id) === String(doc._id) : false}
                  onClick={isUsersCollection ? () => handleUserClick(doc) : undefined}
                  priorityFields={isUsersCollection ? ['userName', 'phone', 'externalId', 'status'] : undefined}
                  cardRef={mainCardRefs[i]}
                  positionOffset={mainPositionOffsets[i]}
                />
              ))}
            </div>
          )}
        </div>

        <PaginationBar
          page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
        />
        </>
        )}
      </div>

      {/* Related panel */}
      {selectedUser && (
        <div className="w-1/2 flex flex-col border-l-2 border-green-500 bg-green-50 dark:bg-green-900/10 transition-all duration-300">
          {/* Related header */}
          <div className="p-5 border-b border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-green-800 dark:text-green-300 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  user_patterns
                </h3>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                  externalId: <span className="font-mono font-semibold">{String(selectedUser.externalId)}</span>
                  {' '}• {relatedTotal} records
                </p>
              </div>
              <button
                onClick={() => { setSelectedUser(null); setRelatedDocs([]); setStatusFilter('all'); }}
                className="p-1.5 text-green-700 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-green-700 dark:text-green-400">Filter by status:</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setRelatedPage(1); }}
                className="px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-green-300 dark:border-green-600 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>

          {/* Related docs */}
          <div className="flex-1 overflow-auto p-4">
            {relatedLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
              </div>
            ) : relatedDocs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No patterns found for this user
              </div>
            ) : (
              <div className="space-y-3">
                {relatedDocs.map((doc, i) => (
                  <DocCard
                    key={String(doc._id)}
                    doc={doc}
                    index={(relatedPage - 1) * 20 + i + 1}
                    isSelected={false}
                    cardRef={relatedCardRefs[i]}
                    positionOffset={relatedPositionOffsets[i]}
                  />
                ))}
              </div>
            )}
          </div>

          <PaginationBar
            page={relatedPage} totalPages={relatedTotalPages} total={relatedTotal} pageSize={20}
            onPrev={() => setRelatedPage(p => Math.max(1, p - 1))}
            onNext={() => setRelatedPage(p => Math.min(relatedTotalPages, p + 1))}
          />
        </div>
      )}
    </div>
  );
}
