# Annotation Node Right-Click Color Picker

## Overview

Task 5.2 implements right-click context menu functionality for annotation nodes to show the color picker. This allows users to change the color of annotation boxes by right-clicking on them.

## Implementation Details

### Architecture

The right-click functionality is implemented at the **ReactFlow level** rather than within the AnnotationNode component itself. This design decision provides several benefits:

1. **Consistency**: All nodes (user, pattern, and annotation) use the same right-click mechanism
2. **Simplicity**: No need for custom event handling in each node component
3. **Maintainability**: Color picker logic is centralized in RelationBoard

### How It Works

```typescript
// In RelationBoard.tsx

// 1. ReactFlow captures right-click events on ALL nodes
<ReactFlow
  nodes={nodes}
  onNodeContextMenu={handleNodeContextMenu}  // <-- Handles right-click for all nodes
  nodeTypes={nodeTypes}
  ...
/>

// 2. Handler shows color picker at cursor position
const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
  e.preventDefault();
  setColorPicker({ x: e.clientX, y: e.clientY, nodeId: node.id });
}, []);

// 3. ColorPicker detects annotation nodes and shows appropriate colors
function ColorPicker({ nodeId, ... }) {
  const isAnnotationNode = nodeId.startsWith('annotation-');
  const colors = isAnnotationNode ? COLOR_PRESETS : COLORS;
  // ... renders solid colors for annotations, gradients for user/pattern nodes
}

// 4. Color selection updates node data
const applyColor = useCallback((color) => {
  setNodes(nds => {
    const updated = nds.map(n =>
      n.id === colorPicker.nodeId ? { ...n, data: { ...n.data, color } } : n
    );
    savePositions(updated);  // Persists to localStorage
    return updated;
  });
}, [colorPicker, savePositions]);
```

### Key Components

#### 1. AnnotationNode Registration

```typescript
// AnnotationNode must be registered in nodeTypes
import { AnnotationNode } from './AnnotationNode';

const nodeTypes = { 
  userNode: UserNode, 
  patternNode: PatternNode, 
  annotationNode: AnnotationNode  // <-- Registered here
};
```

#### 2. ColorPicker Component

The ColorPicker component (already extended in task 5.1) automatically detects annotation nodes:

- **Detection**: Checks if `nodeId.startsWith('annotation-')`
- **Colors**: Shows `COLOR_PRESETS` (solid colors) for annotations
- **Rendering**: Displays solid backgrounds instead of gradients
- **Auto-close**: Closes after color selection or click outside

#### 3. AnnotationNode Component

The AnnotationNode component:

- **Does NOT** implement custom right-click handlers
- **Allows** events to bubble up to ReactFlow
- **Applies** color from `data.color` prop to background, border, and UI elements
- **Maintains** color consistency across view and edit modes

## User Experience

### Right-Click Flow

1. User right-clicks on an annotation box
2. Browser context menu is prevented
3. Color picker popup appears at cursor position
4. User sees 8 solid color presets (Yellow, Green, Blue, Purple, Red, Pink, Orange, Gray)
5. User clicks a color
6. Annotation box updates immediately with new color
7. Color picker closes automatically
8. New color is saved to localStorage

### Click Outside

- Clicking outside the color picker closes it without changing the color
- This is handled by a transparent overlay (`<div className="fixed inset-0 z-40" onClick={onClose} />`)

## Color Application

The selected color is applied to multiple elements in the annotation box:

```typescript
// Background and border
<div style={{
  backgroundColor: data.color.background,  // e.g., '#fef3c7'
  borderColor: data.color.border,          // e.g., '#f59e0b'
}}>

// Delete button icon
<svg style={{ color: data.color.border }}>

// Resize handle
<div style={{
  borderRight: `2px solid ${data.color.border}`,
  borderBottom: `2px solid ${data.color.border}`,
}}>
  <svg style={{ color: data.color.border }}>
```

## Testing

### Integration Tests

The implementation is verified by integration tests in `AnnotationNode.integration.test.tsx`:

- ✅ Renders with correct background and border colors
- ✅ Allows right-click events to propagate to ReactFlow
- ✅ Displays color in view mode
- ✅ Maintains color when switching between view and edit modes
- ✅ Renders with different color presets
- ✅ Applies color to delete button icon
- ✅ Applies color to resize handle

### Manual Testing

To test manually:

1. Create an annotation box (task 8.2)
2. Right-click on the annotation box
3. Verify color picker appears at cursor position
4. Click a different color
5. Verify annotation box updates immediately
6. Verify color persists after page reload
7. Click outside color picker to verify it closes without changing color

## Requirements Validated

This implementation validates the following requirements:

- **5.1**: Right-click shows color picker popup ✅
- **5.2**: Color picker provides 8 preset colors ✅
- **5.3**: Color selection applies to annotation box ✅
- **5.4**: Color is saved to localStorage ✅
- **5.5**: Color picker closes after selection ✅
- **5.6**: Click outside closes picker without change ✅

## Related Tasks

- **Task 5.1**: Extend ColorPicker component to support annotation nodes (completed)
- **Task 5.2**: Implement right-click context menu (this task)
- **Task 5.3**: Write unit tests for color picker integration (optional)
- **Task 8.1**: Register AnnotationNode as custom node type (completed as part of this task)

## Notes

- The right-click functionality works automatically once AnnotationNode is registered in `nodeTypes`
- No custom event handlers are needed in the AnnotationNode component
- The ColorPicker component handles both user/pattern nodes (gradients) and annotation nodes (solid colors)
- Color changes are persisted to localStorage through the `savePositions` function
