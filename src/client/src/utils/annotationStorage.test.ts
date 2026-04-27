import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ANNOTATION_STORAGE_KEY, saveAnnotations, loadAnnotations } from './annotationStorage';
import { AnnotationNode, COLOR_PRESETS } from '../types/annotations';

describe('annotationStorage utilities', () => {
  const testConnectionId = 'test-conn-123';
  const testDatabase = 'test-db';
  const testBoardKey = 'test-board';
  const storageKey = ANNOTATION_STORAGE_KEY(testConnectionId, testDatabase, testBoardKey);

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('ANNOTATION_STORAGE_KEY', () => {
    it('should generate correct storage key format', () => {
      const key = ANNOTATION_STORAGE_KEY('conn1', 'mydb', 'relation-board');
      expect(key).toBe('annotation-boxes:relation-board:conn1:mydb');
    });

    it('should generate unique keys for different connections', () => {
      const key1 = ANNOTATION_STORAGE_KEY('conn1', 'db1', 'relation-board');
      const key2 = ANNOTATION_STORAGE_KEY('conn2', 'db1', 'relation-board');
      expect(key1).not.toBe(key2);
    });

    it('should generate unique keys for different databases', () => {
      const key1 = ANNOTATION_STORAGE_KEY('conn1', 'db1', 'relation-board');
      const key2 = ANNOTATION_STORAGE_KEY('conn1', 'db2', 'relation-board');
      expect(key1).not.toBe(key2);
    });

    it('should generate unique keys for different boards', () => {
      const key1 = ANNOTATION_STORAGE_KEY('conn1', 'db1', 'club-board');
      const key2 = ANNOTATION_STORAGE_KEY('conn1', 'db1', 'relation-board');
      expect(key1).not.toBe(key2);
    });
  });

  describe('saveAnnotations', () => {
    it('should save annotation nodes to localStorage', () => {
      const annotationNode: AnnotationNode = {
        id: 'annotation-123',
        type: 'annotationNode',
        position: { x: 100, y: 200 },
        data: {
          id: '123',
          content: 'Test annotation',
          color: COLOR_PRESETS[0],
          width: 200,
          height: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      saveAnnotations([annotationNode], testConnectionId, testDatabase, testBoardKey);

      const stored = localStorage.getItem(storageKey);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed['annotation-123']).toBeDefined();
    });

    it('should filter out non-annotation nodes', () => {
      const nodes = [
        {
          id: 'annotation-123',
          type: 'annotationNode',
          position: { x: 100, y: 200 },
          data: {
            id: '123',
            content: 'Test',
            color: COLOR_PRESETS[0],
            width: 200,
            height: 100,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
        {
          id: 'user-1',
          type: 'userNode',
          position: { x: 0, y: 0 },
          data: { name: 'User 1' },
        },
      ];

      saveAnnotations(nodes as AnnotationNode[], testConnectionId, testDatabase, testBoardKey);

      const stored = localStorage.getItem(storageKey);
      const parsed = JSON.parse(stored!);

      expect(parsed['annotation-123']).toBeDefined();
      expect(parsed['user-1']).toBeUndefined();
    });

    it('should handle empty node array', () => {
      saveAnnotations([], testConnectionId, testDatabase, testBoardKey);

      const stored = localStorage.getItem(storageKey);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(Object.keys(parsed)).toHaveLength(0);
    });
  });

  describe('loadAnnotations', () => {
    it('should load annotations from localStorage', () => {
      const storedData = {
        'annotation-123': {
          content: 'Test annotation',
          color: COLOR_PRESETS[0],
          width: 200,
          height: 100,
          x: 100,
          y: 200,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      localStorage.setItem(storageKey, JSON.stringify(storedData));

      const loaded = loadAnnotations(testConnectionId, testDatabase, testBoardKey);

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('annotation-123');
      expect(loaded[0].type).toBe('annotationNode');
      expect(loaded[0].position.x).toBe(100);
      expect(loaded[0].position.y).toBe(200);
      expect(loaded[0].data.content).toBe('Test annotation');
    });

    it('should return empty array when no data exists', () => {
      const loaded = loadAnnotations(testConnectionId, testDatabase, testBoardKey);
      expect(loaded).toEqual([]);
    });

    it('should return empty array on corrupted JSON', () => {
      localStorage.setItem(storageKey, 'invalid json {{{');

      const loaded = loadAnnotations(testConnectionId, testDatabase, testBoardKey);
      expect(loaded).toEqual([]);
    });

    it('should handle multiple annotations', () => {
      const storedData = {
        'annotation-1': {
          content: 'First',
          color: COLOR_PRESETS[0],
          width: 200,
          height: 100,
          x: 100,
          y: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        'annotation-2': {
          content: 'Second',
          color: COLOR_PRESETS[1],
          width: 300,
          height: 150,
          x: 200,
          y: 200,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };

      localStorage.setItem(storageKey, JSON.stringify(storedData));

      const loaded = loadAnnotations(testConnectionId, testDatabase, testBoardKey);

      expect(loaded).toHaveLength(2);
      expect(loaded.find(n => n.id === 'annotation-1')).toBeDefined();
      expect(loaded.find(n => n.id === 'annotation-2')).toBeDefined();
    });
  });
});
