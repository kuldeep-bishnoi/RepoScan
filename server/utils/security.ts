import path from "path";
import crypto from "crypto";

/**
 * Security utilities for input validation and path sanitization
 */
export class SecurityUtils {
  /**
   * Sanitizes repository names to prevent path traversal
   */
  static sanitizeRepositoryName(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid repository name');
    }
    
    // Remove any path traversal attempts and normalize
    const sanitized = path.normalize(name).replace(/^(\.\.[\/\\])+/, '');
    
    // Ensure it only contains safe characters for directory names
    const safeName = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    
    if (safeName.length === 0) {
      throw new Error('Repository name contains no valid characters');
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
    
    // Resolve both paths to ensure they're absolute
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
    const sanitizedPrefix = this.sanitizeRepositoryName(prefix);
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const finalSuffix = suffix ? `-${this.sanitizeRepositoryName(suffix)}` : '';
    
    return `${sanitizedPrefix}-${randomBytes}${finalSuffix}`;
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