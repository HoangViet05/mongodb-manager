# useResize Hook Integration Example

This document shows how to integrate the `useResize` hook into the `AnnotationNode` component (Task 4.3).

## Integration Steps

### 1. Import the hook

```typescript
import { useResize } from './useResize';
```

### 2. Use the hook in the component

```typescript
export function AnnotationNode({ data, id }: NodeProps<AnnotationData>) {
  // ... existing state ...

  // Add resize hook
  const { size, isResizing, handleResizeStart } = useResize(
    id,
    data.width,
    data.height,
    (newWidth, newHeight) => {
      // TODO: Update node data in ReactFlow state and save to localStorage
      // This will be implemented in task 4.3
      console.log('Resize ended:', id, newWidth, newHeight);
    }
  );

  // ... rest of component ...
}
```

### 3. Update the component's style to use the hook's size

```typescript
<div
  className="annotation-box relative rounded-lg border-2 shadow-lg transition-all duration-200"
  style={{
    width: size.width,  // Changed from data.width
    height: size.height, // Changed from data.height
    backgroundColor: data.color.background,
    borderColor: data.color.border,
    opacity: isHovered ? 1 : 0.9,
    cursor: isEditing ? 'default' : isResizing ? 'se-resize' : 'grab',
  }}
  // ... rest of props ...
>
```

### 4. The resize handle already uses handleResizeStart

The existing resize handle in the component already has an `onMouseDown` handler that can be replaced with the hook's `handleResizeStart`:

```typescript
<div
  onMouseDown={handleResizeStart}  // This is already correct!
  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
  // ... rest of props ...
>
```

## Complete Integration (Task 4.3)

Task 4.3 will:
1. Import and use the `useResize` hook
2. Replace `data.width` and `data.height` with `size.width` and `size.height`
3. Implement the `onResizeEnd` callback to update ReactFlow state and localStorage
4. Update cursor style to show `se-resize` when `isResizing` is true

## Testing

The hook has been tested with the following scenarios:
- ✅ Initialize with provided width and height
- ✅ Set isResizing to true when resize starts
- ✅ Enforce minimum width constraint (150px)
- ✅ Enforce maximum width constraint (600px)
- ✅ Enforce minimum height constraint (80px)
- ✅ Enforce maximum height constraint (400px)
- ✅ Call onResizeEnd when mouse is released
- ✅ Update size during resize operation

All tests pass successfully!
