import { useState, useCallback, useRef, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import { AnnotationData } from '../../types/annotations';
import { useResize } from './useResize';

/**
 * AnnotationNode Component - View and Edit Mode
 * 
 * Custom ReactFlow node for annotation boxes on RelationBoard.
 * Displays text content with delete button and resize handle.
 * Supports double-click to edit with textarea, character counter, and save/cancel buttons.
 * Supports resizing via drag handle in bottom-right corner.
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.5, 4.6, 6.1, 8.1, 8.2, 8.5
 */
export function AnnotationNode({ data, id }: NodeProps<AnnotationData>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resize hook integration
  const handleResizeEnd = useCallback((width: number, height: number) => {
    if (data.onResize) {
      data.onResize(id, width, height);
    }
  }, [id, data]);

  const { size, isResizing, handleResizeStart } = useResize(
    id,
    data.width,
    data.height,
    handleResizeEnd
  );

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setEditContent(data.content);
  }, [data.content]);

  const handleSave = useCallback(() => {
    if (data.onSave) {
      data.onSave(id, editContent);
    }
    setIsEditing(false);
  }, [id, editContent, data]);

  const handleCancel = useCallback(() => {
    setEditContent(data.content);
    setIsEditing(false);
  }, [data.content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleCancel]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      'Are you sure you want to delete this annotation? This action cannot be undone.'
    );
    
    if (confirmed && data.onDelete) {
      data.onDelete(id);
    }
  }, [id, data]);

  const remainingChars = 1000 - editContent.length;
  const isOverLimit = editContent.length > 1000;

  return (
    <div
      className="annotation-box relative rounded-lg border-2 shadow-lg transition-all duration-200"
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: data.color.background,
        borderColor: data.color.border,
        opacity: isHovered ? 1 : 0.9,
        cursor: isEditing ? 'default' : isResizing ? 'se-resize' : 'grab',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={isEditing ? undefined : handleDoubleClick}
    >
      {isEditing ? (
        /* Edit Mode */
        <div className="edit-mode h-full flex flex-col p-2">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={1000}
            className="flex-1 w-full resize-none p-2 text-sm text-gray-800 dark:text-gray-200 bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter annotation text..."
            style={{ minHeight: '60px' }}
          />
          
          {/* Character Counter */}
          <div className={`text-xs mt-1 ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
            {remainingChars} characters remaining
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={isOverLimit}
              className="flex-1 px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* View Mode */
        <>
          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="absolute top-2 right-2 p-1 rounded hover:bg-black/10 transition-colors z-10"
            title="Delete annotation"
            style={{ cursor: 'pointer' }}
          >
            <svg
              className="w-4 h-4"
              style={{ color: data.color.border }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>

          {/* Content Display */}
          <div
            className="p-4 pr-8 h-full overflow-auto text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words"
            style={{ wordWrap: 'break-word' }}
          >
            {data.content}
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={handleResizeStart}
            className="nodrag nopan absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            style={{
              borderRight: `2px solid ${data.color.border}`,
              borderBottom: `2px solid ${data.color.border}`,
              borderBottomRightRadius: '0.5rem',
            }}
            title="Drag to resize"
          >
            <svg
              className="w-3 h-3 absolute bottom-0.5 right-0.5"
              style={{ color: data.color.border }}
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M14 14V8h-2v4h-4v2h6z" />
              <path d="M10 10V6H8v2H6v2h4z" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
