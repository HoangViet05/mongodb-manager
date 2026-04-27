import { useState, useCallback, useRef } from 'react';

/**
 * Size constraints for annotation boxes
 */
const MIN_WIDTH = 150;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;

/**
 * Custom hook for handling resize operations on annotation boxes
 * 
 * Manages resize state and provides handlers for resize start, move, and end.
 * Enforces size constraints (150-600px width, 80-400px height).
 * 
 * @param nodeId - The ID of the annotation node being resized
 * @param initialWidth - Initial width of the annotation box
 * @param initialHeight - Initial height of the annotation box
 * @param onResizeEnd - Callback function called when resize operation ends with new size
 * @returns Object containing current size, isResizing state, and handleResizeStart function
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export const useResize = (
  _nodeId: string,
  initialWidth: number,
  initialHeight: number,
  onResizeEnd: (width: number, height: number) => void
) => {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: initialWidth, height: initialHeight });
  const currentSizeRef = useRef({ width: initialWidth, height: initialHeight });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startSizeRef.current = { width: currentSizeRef.current.width, height: currentSizeRef.current.height };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPosRef.current.x;
      const deltaY = moveEvent.clientY - startPosRef.current.y;

      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, startSizeRef.current.width + deltaX)
      );
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, startSizeRef.current.height + deltaY)
      );

      currentSizeRef.current = { width: newWidth, height: newHeight };
      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onResizeEnd(currentSizeRef.current.width, currentSizeRef.current.height);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResizeEnd]);

  return {
    size,
    isResizing,
    handleResizeStart,
  };
};
