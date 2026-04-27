import { Node } from 'reactflow';
import { AnnotationNode, StoredAnnotations } from '../types/annotations';

/**
 * Generate localStorage key for annotation boxes
 * Format: "annotation-boxes:{connectionId}:{database}"
 * 
 * @param connId - Connection ID
 * @param db - Database name
 * @returns localStorage key string
 */
export const ANNOTATION_STORAGE_KEY = (connId: string, db: string, boardKey: string): string =>
  `annotation-boxes:${boardKey}:${connId}:${db}`;

/**
 * Save annotation nodes to localStorage
 * Filters nodes to only include annotation nodes and persists their data
 * 
 * @param nodes - Array of ReactFlow nodes (may include non-annotation nodes)
 * @param connectionId - Connection ID
 * @param database - Database name
 */
export const saveAnnotations = (
  nodes: Node[],
  connectionId: string,
  database: string,
  boardKey: string,
): void => {
  try {
    const annotations = nodes
      .filter(n => n.type === 'annotationNode')
      .reduce((acc, node) => {
        const annotationNode = node as AnnotationNode;
        acc[node.id] = {
          content: annotationNode.data.content,
          color: annotationNode.data.color,
          width: annotationNode.data.width,
          height: annotationNode.data.height,
          x: annotationNode.position.x,
          y: annotationNode.position.y,
          createdAt: annotationNode.data.createdAt,
          updatedAt: annotationNode.data.updatedAt,
        };
        return acc;
      }, {} as StoredAnnotations);

    localStorage.setItem(
      ANNOTATION_STORAGE_KEY(connectionId, database, boardKey),
      JSON.stringify(annotations)
    );
  } catch (error) {
    console.error('Failed to save annotations to localStorage:', error);
  }
};

/**
 * Load annotation nodes from localStorage
 * Returns empty array if no data exists or if parsing fails
 * 
 * @param connectionId - Connection ID
 * @param database - Database name
 * @returns Array of AnnotationNode objects
 */
export const loadAnnotations = (
  connectionId: string,
  database: string,
  boardKey: string,
): AnnotationNode[] => {
  try {
    const raw = localStorage.getItem(
      ANNOTATION_STORAGE_KEY(connectionId, database, boardKey)
    );
    
    if (!raw) {
      return [];
    }

    const stored: StoredAnnotations = JSON.parse(raw);

    return Object.entries(stored).map(([id, data]) => ({
      id,
      type: 'annotationNode' as const,
      position: { x: data.x, y: data.y },
      data: {
        id: id.replace('annotation-', ''),
        content: data.content,
        color: data.color,
        width: data.width,
        height: data.height,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    }));
  } catch (error) {
    console.error('Failed to load annotations from localStorage:', error);
    return [];
  }
};
