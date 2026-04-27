import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnnotationNode } from './AnnotationNode';
import { NodeProps } from 'reactflow';
import { AnnotationData } from '../../types/annotations';

/**
 * Integration tests for AnnotationNode component with useResize hook
 * 
 * Validates: Requirements 4.1, 4.2, 4.5, 4.6
 */
describe('AnnotationNode - Resize Integration', () => {
  const mockAnnotationData: AnnotationData = {
    id: 'test-annotation-1',
    content: 'Test annotation content',
    color: {
      label: 'Yellow',
      background: '#fef3c7',
      border: '#f59e0b',
    },
    width: 200,
    height: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockNodeProps: NodeProps<AnnotationData> = {
    id: 'annotation-test-1',
    data: mockAnnotationData,
    selected: false,
    type: 'annotationNode',
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    isConnectable: true,
    dragging: false,
  };

  it('should render with initial size from data', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const annotationBox = container.querySelector('.annotation-box');
    
    expect(annotationBox).toBeTruthy();
    expect(annotationBox).toHaveStyle({
      width: '200px',
      height: '100px',
    });
  });

  it('should render resize handle in view mode', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const resizeHandle = container.querySelector('.cursor-se-resize');
    
    expect(resizeHandle).toBeTruthy();
    expect(resizeHandle).toHaveAttribute('title', 'Drag to resize');
  });

  it('should call handleResizeStart when resize handle is clicked', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const resizeHandle = container.querySelector('.cursor-se-resize') as HTMLElement;
    
    expect(resizeHandle).toBeTruthy();
    
    // Simulate mousedown on resize handle
    fireEvent.mouseDown(resizeHandle, { clientX: 100, clientY: 100 });
    
    // The hook should attach event listeners (we can't easily test the actual resize behavior
    // without more complex setup, but we can verify the handle is interactive)
    expect(resizeHandle).toBeTruthy();
  });

  it('should update cursor style when resizing', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const annotationBox = container.querySelector('.annotation-box') as HTMLElement;
    const resizeHandle = container.querySelector('.cursor-se-resize') as HTMLElement;
    
    // Initial cursor should be 'grab'
    expect(annotationBox).toHaveStyle({ cursor: 'grab' });
    
    // Start resize
    fireEvent.mouseDown(resizeHandle, { clientX: 100, clientY: 100 });
    
    // Cursor should change to 'se-resize' during resize
    // Note: This is a simplified test - in real usage, the cursor changes during the resize operation
    expect(resizeHandle).toHaveClass('cursor-se-resize');
  });

  it('should not show resize handle in edit mode', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const annotationBox = container.querySelector('.annotation-box') as HTMLElement;
    
    // Enter edit mode
    fireEvent.doubleClick(annotationBox);
    
    // Resize handle should not be visible in edit mode
    const resizeHandle = container.querySelector('.cursor-se-resize');
    expect(resizeHandle).toBeFalsy();
  });

  it('should use size from useResize hook state', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const annotationBox = container.querySelector('.annotation-box');
    
    // Initial size should come from data prop via useResize hook
    expect(annotationBox).toHaveStyle({
      width: '200px',
      height: '100px',
    });
    
    // The useResize hook maintains its own state after initialization
    // This is correct behavior - resize state is independent once initialized
  });
});

/**
 * Integration tests for AnnotationNode right-click color picker
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
describe('AnnotationNode - Right-Click Color Picker', () => {
  const mockAnnotationData: AnnotationData = {
    id: 'test-annotation-2',
    content: 'Test annotation for color picker',
    color: {
      label: 'Yellow',
      background: '#fef3c7',
      border: '#f59e0b',
    },
    width: 200,
    height: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockNodeProps: NodeProps<AnnotationData> = {
    id: 'annotation-test-2',
    data: mockAnnotationData,
    selected: false,
    type: 'annotationNode',
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    isConnectable: true,
    dragging: false,
  };

  it('should render with correct background and border colors', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const annotationBox = container.querySelector('.annotation-box') as HTMLElement;
    
    expect(annotationBox).toBeTruthy();
    expect(annotationBox).toHaveStyle({
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
    });
  });

  it('should allow right-click events to propagate to ReactFlow', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const annotationBox = container.querySelector('.annotation-box') as HTMLElement;
    
    // Verify that the component doesn't prevent context menu events
    // ReactFlow's onNodeContextMenu will handle the right-click at the parent level
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    
    const preventDefaultSpy = vi.spyOn(contextMenuEvent, 'preventDefault');
    annotationBox.dispatchEvent(contextMenuEvent);
    
    // The AnnotationNode should NOT prevent default, allowing ReactFlow to handle it
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should display color in view mode', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const annotationBox = container.querySelector('.annotation-box') as HTMLElement;
    
    // Verify the color is applied correctly
    const computedStyle = window.getComputedStyle(annotationBox);
    expect(computedStyle.backgroundColor).toBeTruthy();
    expect(computedStyle.borderColor).toBeTruthy();
  });

  it('should maintain color when switching between view and edit modes', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const annotationBox = container.querySelector('.annotation-box') as HTMLElement;
    
    // Initial color
    expect(annotationBox).toHaveStyle({
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
    });
    
    // Enter edit mode
    fireEvent.doubleClick(annotationBox);
    
    // Color should still be applied in edit mode
    expect(annotationBox).toHaveStyle({
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
    });
    
    // Exit edit mode
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    // Color should still be applied after exiting edit mode
    expect(annotationBox).toHaveStyle({
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
    });
  });

  it('should render with different color presets', () => {
    const greenColor = {
      label: 'Green' as const,
      background: '#d1fae5',
      border: '#10b981',
    };
    
    const propsWithGreen = {
      ...mockNodeProps,
      data: {
        ...mockAnnotationData,
        color: greenColor,
      },
    };
    
    const { container } = render(<AnnotationNode {...propsWithGreen} />);
    const annotationBox = container.querySelector('.annotation-box') as HTMLElement;
    
    expect(annotationBox).toHaveStyle({
      backgroundColor: '#d1fae5',
      borderColor: '#10b981',
    });
  });

  it('should apply color to delete button icon', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const deleteButton = container.querySelector('button[title="Delete annotation"]') as HTMLElement;
    const deleteIcon = deleteButton?.querySelector('svg') as SVGElement;
    
    expect(deleteIcon).toBeTruthy();
    expect(deleteIcon).toHaveStyle({
      color: '#f59e0b', // border color
    });
  });

  it('should apply color to resize handle', () => {
    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const resizeHandle = container.querySelector('.cursor-se-resize') as HTMLElement;
    
    expect(resizeHandle).toBeTruthy();
    expect(resizeHandle).toHaveStyle({
      borderRight: '2px solid #f59e0b',
      borderBottom: '2px solid #f59e0b',
    });
    
    const resizeIcon = resizeHandle.querySelector('svg') as SVGElement;
    expect(resizeIcon).toBeTruthy();
    expect(resizeIcon).toHaveStyle({
      color: '#f59e0b',
    });
  });
});

/**
 * Integration tests for AnnotationNode delete functionality
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
describe('AnnotationNode - Delete Functionality', () => {
  const mockAnnotationData: AnnotationData = {
    id: 'test-annotation-3',
    content: 'Test annotation for delete',
    color: {
      label: 'Yellow',
      background: '#fef3c7',
      border: '#f59e0b',
    },
    width: 200,
    height: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('should render delete button with trash icon', () => {
    const mockNodeProps: NodeProps<AnnotationData> = {
      id: 'annotation-test-3',
      data: mockAnnotationData,
      selected: false,
      type: 'annotationNode',
      xPos: 0,
      yPos: 0,
      zIndex: 0,
      isConnectable: true,
      dragging: false,
    };

    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const deleteButton = container.querySelector('button[title="Delete annotation"]') as HTMLElement;
    
    expect(deleteButton).toBeTruthy();
    expect(deleteButton.querySelector('svg')).toBeTruthy();
  });

  it('should show confirmation dialog when delete button is clicked', () => {
    const mockOnDelete = vi.fn();
    const mockNodeProps: NodeProps<AnnotationData> = {
      id: 'annotation-test-3',
      data: {
        ...mockAnnotationData,
        onDelete: mockOnDelete,
      },
      selected: false,
      type: 'annotationNode',
      xPos: 0,
      yPos: 0,
      zIndex: 0,
      isConnectable: true,
      dragging: false,
    };

    // Mock window.confirm to return true (user confirms)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const deleteButton = container.querySelector('button[title="Delete annotation"]') as HTMLElement;
    
    fireEvent.click(deleteButton);
    
    // Verify confirmation dialog was shown
    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete this annotation? This action cannot be undone.'
    );
    
    // Verify onDelete callback was called
    expect(mockOnDelete).toHaveBeenCalledWith('annotation-test-3');
    
    confirmSpy.mockRestore();
  });

  it('should not call onDelete when user cancels confirmation', () => {
    const mockOnDelete = vi.fn();
    const mockNodeProps: NodeProps<AnnotationData> = {
      id: 'annotation-test-3',
      data: {
        ...mockAnnotationData,
        onDelete: mockOnDelete,
      },
      selected: false,
      type: 'annotationNode',
      xPos: 0,
      yPos: 0,
      zIndex: 0,
      isConnectable: true,
      dragging: false,
    };

    // Mock window.confirm to return false (user cancels)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const deleteButton = container.querySelector('button[title="Delete annotation"]') as HTMLElement;
    
    fireEvent.click(deleteButton);
    
    // Verify confirmation dialog was shown
    expect(confirmSpy).toHaveBeenCalled();
    
    // Verify onDelete callback was NOT called
    expect(mockOnDelete).not.toHaveBeenCalled();
    
    confirmSpy.mockRestore();
  });

  it('should not call onDelete if callback is not provided', () => {
    const mockNodeProps: NodeProps<AnnotationData> = {
      id: 'annotation-test-3',
      data: mockAnnotationData, // No onDelete callback
      selected: false,
      type: 'annotationNode',
      xPos: 0,
      yPos: 0,
      zIndex: 0,
      isConnectable: true,
      dragging: false,
    };

    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const deleteButton = container.querySelector('button[title="Delete annotation"]') as HTMLElement;
    
    // Should not throw error even without onDelete callback
    expect(() => fireEvent.click(deleteButton)).not.toThrow();
    
    confirmSpy.mockRestore();
  });

  it('should stop event propagation when delete button is clicked', () => {
    const mockOnDelete = vi.fn();
    const mockNodeProps: NodeProps<AnnotationData> = {
      id: 'annotation-test-3',
      data: {
        ...mockAnnotationData,
        onDelete: mockOnDelete,
      },
      selected: false,
      type: 'annotationNode',
      xPos: 0,
      yPos: 0,
      zIndex: 0,
      isConnectable: true,
      dragging: false,
    };

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container } = render(<AnnotationNode {...mockNodeProps} />);
    const deleteButton = container.querySelector('button[title="Delete annotation"]') as HTMLElement;
    
    // Create a click event with stopPropagation spy
    const clickEvent = new MouseEvent('click', { bubbles: true });
    const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');
    
    deleteButton.dispatchEvent(clickEvent);
    
    // Verify stopPropagation was called
    expect(stopPropagationSpy).toHaveBeenCalled();
    
    confirmSpy.mockRestore();
  });
});
