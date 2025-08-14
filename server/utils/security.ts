import path from "path";
import crypto from "crypto";

/**
 * Security utilities for input validation and path sanitization
 * All methods implement defense-in-depth against path traversal attacks
 */
export class SecurityUtils {
  /**
   * Validates that a path contains only safe characters and patterns
   */
  private static isPathSafe(inputPath: string): boolean {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /\.\./,           // Path traversal
      /[<>:"|?*]/,      // Invalid filename characters
      /[\x00-\x1f]/,    // Control characters
      /^[a-zA-Z]:/,     // Windows drive letters (when not expected)
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(inputPath));
  }
  /**
   * Sanitizes repository names to prevent path traversal
   */
  static sanitizeRepositoryName(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid repository name');
    }
    
    // Pre-validation check for obvious malicious patterns
    if (!this.isPathSafe(name)) {
      throw new Error('Repository name contains unsafe characters');
    }
    
    // Remove any path traversal attempts and normalize
    const sanitized = path.normalize(name).replace(/^(\.\.[\/\\])+/, '');
    
    // Ensure it only contains safe characters for directory names
    const safeName = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    
    if (safeName.length === 0) {
      throw new Error('Repository name contains no valid characters');
    }
    
    // Final safety check
    if (safeName.includes('..') || safeName.startsWith('.')) {
      throw new Error('Sanitized name still contains unsafe patterns');
    }
    
    return safeName;
  }

  /**
   * Validates that a file path is within the allowed directory
   */
  static validatePath(baseDirectory: string, filePath: string): string {
    if (!baseDirectory || !filePath) {
      throw new Error('Invalid path parameters');
    }
    
    // Additional input validation to prevent malicious paths
    if (filePath.includes('..') || filePath.includes('\0') || baseDirectory.includes('..') || baseDirectory.includes('\0')) {
      throw new Error('Invalid characters detected in path');
    }
    
    // Resolve both paths to ensure they're absolute and normalized
    const resolvedBase = path.resolve(baseDirectory);
    const resolvedFile = path.resolve(filePath);
    
    // Ensure the file path is within the base directory
    if (!resolvedFile.startsWith(resolvedBase + path.sep) && resolvedFile !== resolvedBase) {
      throw new Error('Path traversal attempt detected');
    }
    
    return resolvedFile;
  }

  /**
   * Generates a secure temporary directory name
   */
  static generateSecureDirectory(prefix: string, suffix?: string): string {
    // Validate inputs to prevent path traversal in directory names
    if (!prefix || typeof prefix !== 'string') {
      throw new Error('Invalid prefix for directory generation');
    }
    
    const sanitizedPrefix = this.sanitizeRepositoryName(prefix);
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const finalSuffix = suffix ? `-${this.sanitizeRepositoryName(suffix)}` : '';
    
    const directoryName = `${sanitizedPrefix}-${randomBytes}${finalSuffix}`;
    
    // Final validation to ensure no path traversal sequences
    if (directoryName.includes('..') || directoryName.includes('/') || directoryName.includes('\\')) {
      throw new Error('Generated directory name contains invalid characters');
    }
    
    return directoryName;
  }

  /**
   * Validates and sanitizes scan ID input
   */
  static validateScanId(scanId: string): string {
    if (!scanId || typeof scanId !== 'string') {
      throw new Error('Invalid scan ID');
    }
    
    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scanId)) {
      throw new Error('Invalid scan ID format');
    }
    
    return scanId;
  }

  /**
   * Safe logging utility that prevents format string vulnerabilities
   */
  static safeLog(message: string, details?: Record<string, unknown>): void {
    // Use structured logging to prevent format string injection
    console.log(message, details ? JSON.stringify(details) : '');
  }

  /**
   * Safe error logging that doesn't expose sensitive information
   */
  static safeErrorLog(message: string, error: unknown): void {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error
    };
    
    console.error(message, JSON.stringify(errorDetails));
  }
}