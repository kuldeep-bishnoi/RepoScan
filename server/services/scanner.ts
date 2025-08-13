import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { type Issue, type ScanOptions } from "@shared/schema";

const execAsync = promisify(exec);

export interface ScanResult {
  issues: Omit<Issue, 'id' | 'scanId'>[];
  filesScanned: number;
  summary: {
    high: number;
    medium: number;
    low: number;
  };
}

export class ScannerService {
  async scanDirectory(directory: string, options: ScanOptions, onProgress?: (step: string, progress: number) => void): Promise<ScanResult> {
    const issues: Omit<Issue, 'id' | 'scanId'>[] = [];
    let filesScanned = 0;

    try {
      // Count total files for progress calculation
      const { stdout: fileCount } = await execAsync(`find "${directory}" -type f | wc -l`);
      filesScanned = parseInt(fileCount.trim()) || 0;

      if (options.eslint) {
        onProgress?.("Running ESLint analysis...", 25);
        const eslintIssues = await this.runESLint(directory);
        issues.push(...eslintIssues);
      }

      if (options.npmAudit) {
        onProgress?.("Running npm audit...", 50);
        const auditIssues = await this.runNpmAudit(directory);
        issues.push(...auditIssues);
      }

      if (options.securityPatterns) {
        onProgress?.("Analyzing security patterns...", 75);
        const securityIssues = await this.analyzeSecurityPatterns(directory);
        issues.push(...securityIssues);
      }

      if (options.deepAnalysis) {
        onProgress?.("Running deep analysis...", 90);
        const deepIssues = await this.runDeepAnalysis(directory);
        issues.push(...deepIssues);
      }

      const summary = {
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length,
      };

      return {
        issues,
        filesScanned,
        summary,
      };
    } catch (error) {
      throw new Error(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async runESLint(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    try {
      const { stdout } = await execAsync(`npx eslint "${directory}" --format=json --ext .js,.jsx,.ts,.tsx`, {
        cwd: directory,
      }).catch(error => {
        // ESLint exits with code 1 when issues are found, but still outputs JSON
        return { stdout: error.stdout || '[]' };
      });

      const results = JSON.parse(stdout || '[]');
      const issues: Omit<Issue, 'id' | 'scanId'>[] = [];

      for (const result of results) {
        for (const message of result.messages) {
          const severity = message.severity === 2 ? 'high' : message.severity === 1 ? 'medium' : 'low';
          
          issues.push({
            severity,
            title: message.message,
            description: `ESLint rule violation: ${message.ruleId || 'unknown'}`,
            file: result.filePath.replace(directory, ''),
            line: message.line,
            column: message.column,
            rule: message.ruleId,
            source: 'eslint',
            remediation: this.getESLintRemediation(message.ruleId),
            cve: null,
          });
        }
      }

      return issues;
    } catch (error) {
      console.warn('ESLint analysis failed:', error);
      return [];
    }
  }

  private async runNpmAudit(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    try {
      // Check if package.json exists
      await fs.access(path.join(directory, 'package.json'));
      
      const { stdout } = await execAsync('npm audit --json', {
        cwd: directory,
      }).catch(error => {
        return { stdout: error.stdout || '{"vulnerabilities": {}}' };
      });

      const auditResult = JSON.parse(stdout || '{"vulnerabilities": {}}');
      const issues: Omit<Issue, 'id' | 'scanId'>[] = [];

      if (auditResult.vulnerabilities) {
        for (const [packageName, vuln] of Object.entries(auditResult.vulnerabilities)) {
          const vulnerability = vuln as any;
          
          issues.push({
            severity: this.mapNpmSeverity(vulnerability.severity),
            title: `${packageName}: ${vulnerability.title || 'Security vulnerability'}`,
            description: vulnerability.overview || `Security vulnerability in ${packageName}`,
            file: 'package.json',
            line: null,
            column: null,
            rule: null,
            source: 'npm-audit',
            remediation: vulnerability.recommendation || `Update ${packageName} to a secure version`,
            cve: vulnerability.cwe?.[0] || null,
          });
        }
      }

      return issues;
    } catch (error) {
      console.warn('npm audit failed:', error);
      return [];
    }
  }

  private async analyzeSecurityPatterns(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    const issues: Omit<Issue, 'id' | 'scanId'>[] = [];
    
    try {
      // Define security patterns to look for
      const patterns = [
        {
          pattern: /eval\s*\(/g,
          severity: 'high' as const,
          title: 'Use of eval() function',
          description: 'The eval() function can execute arbitrary JavaScript code and poses security risks',
          remediation: 'Avoid using eval(). Consider safer alternatives like JSON.parse() or specific parsing functions',
        },
        {
          pattern: /innerHTML\s*=/g,
          severity: 'medium' as const,
          title: 'Potential XSS vulnerability with innerHTML',
          description: 'Setting innerHTML with user input can lead to cross-site scripting attacks',
          remediation: 'Use textContent or properly sanitize HTML content before setting innerHTML',
        },
        {
          pattern: /document\.write\s*\(/g,
          severity: 'medium' as const,
          title: 'Use of document.write',
          description: 'document.write can be dangerous and is not recommended',
          remediation: 'Use modern DOM manipulation methods instead of document.write',
        },
        {
          pattern: /password/gi,
          severity: 'low' as const,
          title: 'Potential hardcoded password',
          description: 'File contains the word "password" which might indicate hardcoded credentials',
          remediation: 'Ensure passwords are not hardcoded in source code',
        },
      ];

      // Get all JavaScript/TypeScript files
      const { stdout: fileList } = await execAsync(`find "${directory}" -type f \\( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \\) | head -100`);
      const files = fileList.trim().split('\n').filter(f => f);

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n');

          for (const { pattern, severity, title, description, remediation } of patterns) {
            lines.forEach((line, lineNumber) => {
              if (pattern.test(line)) {
                issues.push({
                  severity,
                  title,
                  description,
                  file: file.replace(directory, ''),
                  line: lineNumber + 1,
                  column: null,
                  rule: null,
                  source: 'security-patterns',
                  remediation,
                  cve: null,
                });
              }
            });
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      return issues;
    } catch (error) {
      console.warn('Security pattern analysis failed:', error);
      return [];
    }
  }

  private async runDeepAnalysis(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    // Placeholder for deep analysis - could integrate with tools like Semgrep, CodeQL, etc.
    // For now, return empty array
    return [];
  }

  private getESLintRemediation(ruleId: string | null): string {
    const remediations: Record<string, string> = {
      'react-hooks/exhaustive-deps': 'Add missing dependencies to the useEffect dependency array',
      'prefer-const': 'Change let to const for variables that are never reassigned',
      'no-unused-vars': 'Remove unused variables or add underscore prefix',
      'no-console': 'Remove console statements in production code',
      'eqeqeq': 'Use strict equality (===) instead of loose equality (==)',
    };
    
    return remediations[ruleId || ''] || 'Review and fix the ESLint rule violation';
  }

  private mapNpmSeverity(npmSeverity: string): 'high' | 'medium' | 'low' {
    switch (npmSeverity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'high';
      case 'moderate':
      case 'medium':
        return 'medium';
      case 'low':
      case 'info':
      default:
        return 'low';
    }
  }
}
