import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResize } from './useResize';

describe('useResize', () => {
  it('should initialize with provided width and height', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() => 
      useResize('test-node', 200, 100, onResizeEnd)
    );

    expect(result.current.size.width).toBe(200);
    expect(result.current.size.height).toBe(100);
    expect(result.current.isResizing).toBe(false);
  });

  it('should set isResizing to true when resize starts', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() => 
      useResize('test-node', 200, 100, onResizeEnd)
    );

    const mockEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockEvent);
    });

    expect(result.current.isResizing).toBe(true);
  });

  it('should enforce minimum width constraint', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() => 
      useResize('test-node', 200, 100, onResizeEnd)
    );

    const mockStartEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockStartEvent);
    });

    // Simulate dragging left to make width smaller
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: -200, // Large negative delta to try to go below minimum
      clientY: 100,
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    // Width should be clamped to minimum (150px)
    expect(result.current.size.width).toBe(150);
  });

  it('should enforce maximum width constraint', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() => 
      useResize('test-node', 200, 100, onResizeEnd)
    );

    const mockStartEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockStartEvent);
    });

    // Simulate dragging right to make width larger
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 1000, // Large positive delta to try to exceed maximum
      clientY: 100,
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    // Width should be clamped to maximum (600px)
    expect(result.current.size.width).toBe(600);
  });

  it('should enforce minimum height constraint', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() => 
      useResize('test-node', 200, 100, onResizeEnd)
    );

    const mockStartEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockStartEvent);
    });

    // Simulate dragging up to make height smaller
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: -200, // Large negative delta to try to go below minimum
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    // Height should be clamped to minimum (80px)
    expect(result.current.size.height).toBe(80);
  });

  it('should enforce maximum height constraint', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() => 
      useResize('test-node', 200, 100, onResizeEnd)
    );

    const mockStartEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockStartEvent);
    });

    // Simulate dragging down to make height larger
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 1000, // Large positive delta to try to exceed maximum
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    // Height should be clamped to maximum (400px)
    expect(result.current.size.height).toBe(400);
  });

  it('should call onResizeEnd when mouse is released', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() => 
      useResize('test-node', 200, 100, onResizeEnd)
    );

    const mockStartEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockStartEvent);
    });

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');

    act(() => {
      document.dispatchEvent(mouseUpEvent);
    });

    expect(onResizeEnd).toHaveBeenCalledWith(200, 100);
    expect(result.current.isResizing).toBe(false);
  });

  it('should update size during resize operation', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() => 
      useResize('test-node', 200, 100, onResizeEnd)
    );

    const mockStartEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart(mockStartEvent);
    });

    // Simulate dragging to increase size by 50px in both dimensions
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 150,
      clientY: 150,
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    expect(result.current.size.width).toBe(250);
    expect(result.current.size.height).toBe(150);
  });
});
