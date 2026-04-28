import { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { RelationBoard } from './RelationBoard';
import { ClubBoard } from './ClubBoard';
import { DocCard, type Doc } from './DocCard';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SearchBar } from './SearchBar';
import { useCardAnimations } from './useCardAnimations';
import apiClient from '../../api/apiClient';

interface DocumentViewerProps {
  connectionId: string;
  database: string;
  collection: string;
  reloadToken?: number;
}

interface SearchFilter {
  field: string;
  value: string;
}

function buildSearchFilter(searchFilter: SearchFilter | null): Record<string, unknown> | undefined {
  if (!searchFilter) return undefined;
  const { field, value } = searchFilter;
  if (field === '_id') {
    return { _id: value };
  }
  if (value === 'true' || value === 'false') {
    return { [field]: value === 'true' };
  }
  if (value !== '' && !Number.isNaN(Number(value)) && /^-?\d+(\.\d+)?$/.test(value)) {
    return { [field]: Number(value) };
  }
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { [field]: { $regex: escaped, $options: 'i' } };
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

export function DocumentViewer({ connectionId, database, collection, reloadToken }: DocumentViewerProps) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ doc: Doc; collection: string } | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilter | null>(null);

  const { cardRefs: mainCardRefs, positionOffsets: mainPositionOffsets } = useCardAnimations(docs.length);

  const [selectedUser, setSelectedUser] = useState<Doc | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<Doc[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedTotal, setRelatedTotal] = useState(0);
  const [relatedPage, setRelatedPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { cardRefs: relatedCardRefs, positionOffsets: relatedPositionOffsets } = useCardAnimations(relatedDocs.length);

  const isUsersCollection = collection === 'users';
  const isClubsCollection = collection === 'clubs';

  useEffect(() => {
    setPage(1);
    setSelectedUser(null);
    setRelatedDocs([]);
    setStatusFilter('all');
    setEditingDocId(null);
    setSearchFilter(null);
    setSearchVisible(false);
  }, [collection, database, connectionId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter = buildSearchFilter(searchFilter);
      const data = await fetchDocuments(connectionId, database, collection, page, pageSize, filter, { _id: -1 });
      setDocs(data.documents);
      setTotal(data.total);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error ?? e?.message ?? 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [connectionId, database, collection, page, searchFilter]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const loadRelated = useCallback(async (user: Doc, rPage = 1) => {
    const externalId = user.externalId;
    if (!externalId) return;
    setRelatedLoading(true);
    try {
      const filter: Record<string, unknown> = { externalId };
      if (statusFilter !== 'all') {
        filter.status = statusFilter;
      }
      const data = await fetchDocuments(
        connectionId, database, 'user_patterns', rPage, 20,
        filter,
        { createdAt: -1 }
      );
      setRelatedDocs(data.documents);
      setRelatedTotal(data.total);
    } finally {
      setRelatedLoading(false);
    }
  }, [connectionId, database, statusFilter]);

  useEffect(() => {
    if (selectedUser) loadRelated(selectedUser, relatedPage);
  }, [relatedPage, statusFilter, selectedUser, loadRelated]);

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

  const handleSave = async (doc: Doc, updated: Doc) => {
    const docId = String(doc._id);
    try {
      const payload: Record<string, unknown> = { ...updated };
      delete payload._id;
      delete payload.__v;
      await apiClient.put(
        `/connections/${connectionId}/databases/${database}/collections/${collection}/documents/${docId}`,
        payload
      );
      toast.success('Đã lưu');
      setEditingDocId(null);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error ?? e?.message ?? 'Lưu thất bại');
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const docId = String(deleteTarget.doc._id);
    const targetCollection = deleteTarget.collection;
    try {
      await apiClient.delete(
        `/connections/${connectionId}/databases/${database}/collections/${targetCollection}/documents/${docId}`
      );
      toast.success('Đã xoá');
      setDeleteTarget(null);
      if (targetCollection === collection && selectedUser && String(selectedUser._id) === docId) {
        setSelectedUser(null);
        setRelatedDocs([]);
      }
      if (targetCollection === collection) {
        await load();
      } else if (selectedUser) {
        await loadRelated(selectedUser, relatedPage);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error ?? e?.message ?? 'Xoá thất bại');
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchVisible(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const availableFields = useMemo(() => {
    const set = new Set<string>();
    docs.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== '_id' && k !== '__v') set.add(k);
      });
    });
    return Array.from(set).sort();
  }, [docs]);

  const totalPages = Math.ceil(total / pageSize);
  const relatedTotalPages = Math.ceil(relatedTotal / 20);

  return (
    <div className="flex h-full">
      <div className={`flex flex-col transition-all duration-300 ${selectedUser && viewMode === 'list' ? 'w-1/2' : 'w-full'}`}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {collection}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {database} • {total} documents
              {searchFilter && (
                <span className="ml-2 inline-flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">
                  Searching: <span className="font-mono">{searchFilter.field}={searchFilter.value}</span>
                  <button
                    onClick={() => { setSearchFilter(null); setPage(1); }}
                    className="ml-1 hover:text-red-600"
                    title="Clear search"
                  >
                    ×
                  </button>
                </span>
              )}
            </p>
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
            <button
              onClick={() => setSearchVisible(v => !v)}
              className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all flex items-center gap-1.5"
              title="Search (Ctrl+F)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
            <button onClick={load}
              className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <SearchBar
          visible={searchVisible}
          availableFields={availableFields}
          initialField={searchFilter?.field}
          initialValue={searchFilter?.value}
          onSearch={(field, value) => {
            setSearchFilter({ field, value });
            setPage(1);
          }}
          onClear={() => {
            setSearchFilter(null);
            setPage(1);
          }}
          onClose={() => {
            setSearchVisible(false);
            setSearchFilter(null);
            setPage(1);
          }}
        />

        {viewMode === 'board' && isUsersCollection ? (
          <div className="flex-1">
            <RelationBoard connectionId={connectionId} database={database} users={docs} />
          </div>
        ) : viewMode === 'board' && isClubsCollection ? (
          <div className="flex-1">
            <ClubBoard connectionId={connectionId} database={database} clubs={docs} />
          </div>
        ) : (
          <>
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
                      Click a user to view patterns • Double-click any card to edit
                    </p>
                  )}
                  {docs.map((doc, i) => {
                    const docId = String(doc._id);
                    return (
                      <DocCard
                        key={docId}
                        doc={doc}
                        index={(page - 1) * pageSize + i + 1}
                        isSelected={isUsersCollection && selectedUser ? String(selectedUser._id) === docId : false}
                        isEditing={editingDocId === docId}
                        onClick={isUsersCollection ? () => handleUserClick(doc) : undefined}
                        onEnterEdit={() => setEditingDocId(docId)}
                        onSave={(updated) => handleSave(doc, updated)}
                        onCancel={() => setEditingDocId(null)}
                        onDelete={() => setDeleteTarget({ doc, collection })}
                        priorityFields={isUsersCollection ? ['userName', 'phone', 'externalId', 'status'] : undefined}
                        cardRef={mainCardRefs[i]}
                        positionOffset={mainPositionOffsets[i]}
                      />
                    );
                  })}
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

      {selectedUser && (
        <div className="w-1/2 flex flex-col border-l-2 border-green-500 bg-green-50 dark:bg-green-900/10 transition-all duration-300">
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
                {relatedDocs.map((doc, i) => {
                  const docId = String(doc._id);
                  return (
                    <DocCard
                      key={docId}
                      doc={doc}
                      index={(relatedPage - 1) * 20 + i + 1}
                      isSelected={false}
                      isEditing={editingDocId === docId}
                      onEnterEdit={() => setEditingDocId(docId)}
                      onSave={async (updated) => {
                        const id = String(doc._id);
                        try {
                          const payload: Record<string, unknown> = { ...updated };
                          delete payload._id;
                          delete payload.__v;
                          await apiClient.put(
                            `/connections/${connectionId}/databases/${database}/collections/user_patterns/documents/${id}`,
                            payload
                          );
                          toast.success('Đã lưu');
                          setEditingDocId(null);
                          if (selectedUser) await loadRelated(selectedUser, relatedPage);
                        } catch (err: unknown) {
                          const e = err as { response?: { data?: { error?: string } }; message?: string };
                          toast.error(e?.response?.data?.error ?? e?.message ?? 'Lưu thất bại');
                          throw err;
                        }
                      }}
                      onCancel={() => setEditingDocId(null)}
                      onDelete={() => setDeleteTarget({ doc, collection: 'user_patterns' })}
                      cardRef={relatedCardRefs[i]}
                      positionOffset={relatedPositionOffsets[i]}
                    />
                  );
                })}
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

      <DeleteConfirmModal
        doc={deleteTarget?.doc ?? null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
