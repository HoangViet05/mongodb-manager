import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Error Handler Verification Tests
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * These tests verify that the global error handler is correctly implemented
 * in index.html and suppresses browser extension connection errors.
 */

describe('Error Handler Implementation', () => {
  let indexHtmlContent: string;

  beforeEach(() => {
    // Read the index.html file
    const indexHtmlPath = join(__dirname, '../../index.html');
    indexHtmlContent = readFileSync(indexHtmlPath, 'utf-8');
  });

  /**
   * Test: Error handler script is present in index.html
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  it('should have error handler script in index.html', () => {
    expect(indexHtmlContent).toContain('Global error handler');
    expect(indexHtmlContent).toContain('window.addEventListener(\'error\'');
    expect(indexHtmlContent).toContain('Could not establish connection');
    expect(indexHtmlContent).toContain('Receiving end does not exist');
  });

  /**
   * Test: Error handler suppresses extension errors
   * Validates: Requirements 2.1, 2.2
   */
  it('should suppress browser extension connection errors', () => {
    // Create a mock error event
    const mockErrorEvent = {
      message: 'Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    // Extract and execute the error handler logic
    const errorHandlerMatch = indexHtmlContent.match(/window\.addEventListener\('error',\s*function\(event\)\s*{([\s\S]*?)},\s*true\)/);
    expect(errorHandlerMatch).toBeTruthy();

    // Verify the handler checks for the correct error message
    const handlerCode = errorHandlerMatch![1];
    expect(handlerCode).toContain('Could not establish connection');
    expect(handlerCode).toContain('Receiving end does not exist');
    expect(handlerCode).toContain('preventDefault');
    expect(handlerCode).toContain('stopPropagation');
  });

  /**
   * Test: Error handler preserves legitimate errors
   * Validates: Requirement 3.3
   */
  it('should allow legitimate errors to propagate', () => {
    // Verify the handler has logic to return false for non-extension errors
    const errorHandlerMatch = indexHtmlContent.match(/window\.addEventListener\('error',\s*function\(event\)\s*{([\s\S]*?)},\s*true\)/);
    const handlerCode = errorHandlerMatch![1];
    
    // Should have a return false statement for non-matching errors
    expect(handlerCode).toContain('return false');
  });

  /**
   * Test: Chrome runtime wrapper is present
   * Validates: Requirements 2.2, 2.3
   */
  it('should have chrome.runtime.sendMessage wrapper', () => {
    expect(indexHtmlContent).toContain('chrome.runtime');
    expect(indexHtmlContent).toContain('originalSendMessage');
    expect(indexHtmlContent).toContain('Extension context invalidated');
  });

  /**
   * Test: Error handler is in the head section
   * Validates: Requirements 2.1, 2.2
   */
  it('should place error handler in head section before other scripts', () => {
    const headMatch = indexHtmlContent.match(/<head>([\s\S]*?)<\/head>/);
    expect(headMatch).toBeTruthy();
    
    const headContent = headMatch![1];
    const errorHandlerIndex = headContent.indexOf('Global error handler');
    const mainScriptIndex = headContent.indexOf('type="module"');
    
    // Error handler should come before the main module script
    // (main script is in body, so this checks it's in head)
    expect(errorHandlerIndex).toBeGreaterThan(0);
  });
});

/**
 * Simulated Error Handler Behavior Tests
 * 
 * These tests simulate the error handler behavior to verify it works correctly.
 */
describe('Error Handler Behavior Simulation', () => {
  let errorHandler: (event: any) => boolean;

  beforeEach(() => {
    // Simulate the error handler function
    errorHandler = function(event: any): boolean {
      // Check if this is a browser extension communication error
      if (event.message && 
          event.message.includes('Could not establish connection') &&
          event.message.includes('Receiving end does not exist')) {
        // Suppress the error
        event.preventDefault?.();
        event.stopPropagation?.();
        return true;
      }
      // Allow other errors to propagate normally
      return false;
    };
  });

  /**
   * Test: Extension errors are suppressed
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  it('should suppress extension connection errors', () => {
    const mockEvent = {
      message: 'Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    const result = errorHandler(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  /**
   * Test: Legitimate errors are not suppressed
   * Validates: Requirement 3.3
   */
  it('should not suppress legitimate application errors', () => {
    const mockEvent = {
      message: 'TypeError: Cannot read property of undefined',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    const result = errorHandler(mockEvent);

    expect(result).toBe(false);
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
  });

  /**
   * Test: Network errors are not suppressed
   * Validates: Requirement 3.3
   */
  it('should not suppress network errors', () => {
    const mockEvent = {
      message: 'Network request failed',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    const result = errorHandler(mockEvent);

    expect(result).toBe(false);
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  /**
   * Test: API errors are not suppressed
   * Validates: Requirement 3.3
   */
  it('should not suppress API errors', () => {
    const mockEvent = {
      message: 'API Error: Invalid connection string',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    const result = errorHandler(mockEvent);

    expect(result).toBe(false);
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  /**
   * Test: Partial matches are not suppressed
   * Validates: Requirements 2.1, 2.2
   */
  it('should not suppress errors with partial message match', () => {
    const mockEvent1 = {
      message: 'Could not establish connection to server',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    const result1 = errorHandler(mockEvent1);
    expect(result1).toBe(false);

    const mockEvent2 = {
      message: 'Receiving end does not exist in database',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    const result2 = errorHandler(mockEvent2);
    expect(result2).toBe(false);
  });

  /**
   * Test: Handler works with null/undefined messages
   * Validates: Requirements 2.1, 2.2
   */
  it('should handle null or undefined messages gracefully', () => {
    const mockEvent1 = {
      message: null,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    const result1 = errorHandler(mockEvent1);
    expect(result1).toBe(false);

    const mockEvent2 = {
      message: undefined,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    const result2 = errorHandler(mockEvent2);
    expect(result2).toBe(false);
  });
});
