import { Node } from 'reactflow';

/**
 * Color preset for annotation boxes
 */
export interface ColorPreset {
  label: 'Yellow' | 'Green' | 'Blue' | 'Purple' | 'Red' | 'Pink' | 'Orange' | 'Gray';
  background: string;  // Hex color for background
  border: string;      // Hex color for border
}

/**
 * Predefined color presets for annotation boxes
 */
export const COLOR_PRESETS: ColorPreset[] = [
  { label: 'Yellow', background: '#fef3c7', border: '#f59e0b' },
  { label: 'Green', background: '#d1fae5', border: '#10b981' },
  { label: 'Blue', background: '#dbeafe', border: '#3b82f6' },
  { label: 'Purple', background: '#e9d5ff', border: '#8b5cf6' },
  { label: 'Red', background: '#fee2e2', border: '#ef4444' },
  { label: 'Pink', background: '#fce7f3', border: '#ec4899' },
  { label: 'Orange', background: '#fed7aa', border: '#f97316' },
  { label: 'Gray', background: '#f3f4f6', border: '#6b7280' },
];

/**
 * Data structure for annotation box content and properties
 */
export interface AnnotationData {
  id: string;              // UUID v4
  content: string;         // Max 1000 characters
  color: ColorPreset;      // One of 8 presets
  width: number;           // 150-600 pixels
  height: number;          // 80-400 pixels
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
  onDelete?: (nodeId: string) => void;  // Callback to delete annotation
  onSave?: (nodeId: string, content: string) => void;  // Callback to save content
  onResize?: (nodeId: string, width: number, height: number) => void;  // Callback to save size
}

/**
 * ReactFlow node type for annotation boxes
 */
export interface AnnotationNode extends Node {
  id: string;              // Format: "annotation-{uuid}"
  type: 'annotationNode';
  position: { x: number; y: number };
  data: AnnotationData;
}

/**
 * LocalStorage schema for persisting annotation boxes
 * Key format: "annotation-boxes:{connectionId}:{database}"
 */
export interface StoredAnnotations {
  [annotationId: string]: {
    content: string;
    color: ColorPreset;
    width: number;
    height: number;
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;
  };
}
