import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { type Issue, type ScanOptions } from "@shared/schema";
import { SecurityUtils } from "../utils/security";

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
        onProgress?.("Analyzing security patterns...", 60);
        const securityIssues = await this.analyzeSecurityPatterns(directory);
        issues.push(...securityIssues);
      }

      if (options.semgrep) {
        onProgress?.("Running Semgrep analysis...", 75);
        const semgrepIssues = await this.runSemgrep(directory);
        issues.push(...semgrepIssues);
      }

      if (options.trivy) {
        onProgress?.("Running Trivy security scan...", 85);
        const trivyIssues = await this.runTrivy(directory);
        issues.push(...trivyIssues);
      }

      if (options.secretScan) {
        onProgress?.("Scanning for secrets...", 90);
        const secretIssues = await this.runSecretScan(directory);
        issues.push(...secretIssues);
      }

      if (options.bandit) {
        onProgress?.("Running Bandit Python security scan...", 95);
        const banditIssues = await this.runBandit(directory);
        issues.push(...banditIssues);
      }

      if (options.safety) {
        onProgress?.("Running Safety dependency check...", 98);
        const safetyIssues = await this.runSafety(directory);
        issues.push(...safetyIssues);
      }

      if (options.deepAnalysis) {
        onProgress?.("Running deep analysis...", 99);
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
            file: SecurityUtils.validatePath(directory, result.filePath).replace(directory, ''),
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
      SecurityUtils.safeErrorLog('ESLint analysis failed', error);
      return [];
    }
  }

  private async runNpmAudit(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    try {
      // Check if package.json exists (validate path for security)
      const packageJsonPath = SecurityUtils.validatePath(directory, path.join(directory, 'package.json'));
      await fs.access(packageJsonPath);
      
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
      SecurityUtils.safeErrorLog('npm audit failed', error);
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
                  file: SecurityUtils.validatePath(directory, file).replace(directory, ''),
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
      SecurityUtils.safeErrorLog('Security pattern analysis failed', error);
      return [];
    }
  }

  private async runSemgrep(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    try {
      // Try to run Semgrep with auto config (covers many languages and security patterns)
      const { stdout } = await execAsync(`semgrep --config=auto --json "${directory}"`, {
        timeout: 120000, // 2 minute timeout
      }).catch(error => {
        // Semgrep exits with non-zero code when findings are present
        return { stdout: error.stdout || '[]' };
      });

      const results = JSON.parse(stdout || '[]');
      const issues: Omit<Issue, 'id' | 'scanId'>[] = [];

      if (results.results) {
        for (const result of results.results) {
          const severity = this.mapSemgrepSeverity(result.extra?.severity || 'INFO');
          
          issues.push({
            severity,
            title: result.extra?.message || result.check_id,
            description: `Semgrep finding: ${result.extra?.message || 'Security issue detected'}`,
            file: SecurityUtils.validatePath(directory, result.path).replace(directory, ''),
            line: result.start?.line || null,
            column: result.start?.col || null,
            rule: result.check_id,
            source: 'semgrep',
            remediation: result.extra?.fix_regex ? 'Apply suggested fix' : 'Review and remediate based on rule documentation',
            cve: null,
          });
        }
      }

      return issues;
    } catch (error) {
      SecurityUtils.safeErrorLog('Semgrep analysis failed', error);
      return [];
    }
  }

  private async runTrivy(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    try {
      // Run Trivy filesystem scan for vulnerabilities and misconfigurations
      const trivyPath = '/home/runner/workspace/trivy';
      const { stdout } = await execAsync(`${trivyPath} fs --format json --quiet "${directory}"`, {
        timeout: 180000, // 3 minute timeout
      }).catch(error => {
        return { stdout: error.stdout || '{"Results": []}' };
      });

      const results = JSON.parse(stdout || '{"Results": []}');
      const issues: Omit<Issue, 'id' | 'scanId'>[] = [];

      if (results.Results) {
        for (const result of results.Results) {
          // Process vulnerabilities
          if (result.Vulnerabilities) {
            for (const vuln of result.Vulnerabilities) {
              issues.push({
                severity: this.mapTrivySeverity(vuln.Severity),
                title: `${vuln.PkgName}: ${vuln.VulnerabilityID}`,
                description: vuln.Description || `Vulnerability in ${vuln.PkgName}`,
                file: result.Target,
                line: null,
                column: null,
                rule: vuln.VulnerabilityID,
                source: 'trivy',
                remediation: vuln.FixedVersion ? `Update to version ${vuln.FixedVersion}` : 'Update to a patched version',
                cve: vuln.VulnerabilityID.startsWith('CVE-') ? vuln.VulnerabilityID : null,
              });
            }
          }

          // Process misconfigurations
          if (result.Misconfigurations) {
            for (const misconfig of result.Misconfigurations) {
              issues.push({
                severity: this.mapTrivySeverity(misconfig.Severity),
                title: misconfig.Title,
                description: misconfig.Description,
                file: result.Target,
                line: misconfig.CauseMetadata?.StartLine || null,
                column: null,
                rule: misconfig.ID,
                source: 'trivy',
                remediation: misconfig.Resolution || 'Fix configuration issue',
                cve: null,
              });
            }
          }
        }
      }

      return issues;
    } catch (error) {
      SecurityUtils.safeErrorLog('Trivy analysis failed', error);
      return [];
    }
  }

  private async runSecretScan(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    try {
      // Use TruffleHog to scan for secrets
      const trufflehogPath = '/home/runner/workspace/trufflehog';
      const { stdout } = await execAsync(`${trufflehogPath} filesystem "${directory}" --json --no-verification`, {
        timeout: 120000, // 2 minute timeout
      }).catch(error => {
        return { stdout: error.stdout || '' };
      });

      const issues: Omit<Issue, 'id' | 'scanId'>[] = [];
      
      if (stdout) {
        const lines = stdout.split('\n').filter(line => line.trim());
        for (const line: string of lines) {
          try {
            const result = JSON.parse(line);
            if (result.DetectorName && result.SourceMetadata) {
              issues.push({
                severity: 'high', // Secrets are typically high severity
                title: `Secret detected: ${result.DetectorName}`,
                description: `Potential secret or credential found: ${result.DetectorName}`,
                file: result.SourceMetadata.Data?.Filesystem?.file || 'Unknown file',
                line: result.SourceMetadata.Data?.Filesystem?.line || null,
                column: null,
                rule: result.DetectorName,
                source: 'secret-scan',
                remediation: 'Remove the secret from code and rotate credentials if compromised',
                cve: null,
              });
            }
          } catch (parseError) {
            // Skip malformed JSON lines
          }
        }
      }

      return issues;
    } catch (error) {
      SecurityUtils.safeErrorLog('Secret scan failed', error);
      return [];
    }
  }

  private async runBandit(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    try {
      // Run Bandit for Python security issues
      const { stdout } = await execAsync(`python3 -m bandit -r "${directory}" -f json`, {
        timeout: 120000, // 2 minute timeout
      }).catch(error => {
        return { stdout: error.stdout || '{"results": []}' };
      });

      const results = JSON.parse(stdout || '{"results": []}');
      const issues: Omit<Issue, 'id' | 'scanId'>[] = [];

      if (results.results) {
        for (const result of results.results) {
          issues.push({
            severity: this.mapBanditSeverity(result.issue_severity),
            title: result.test_name,
            description: result.issue_text,
            file: SecurityUtils.validatePath(directory, result.filename).replace(directory, ''),
            line: result.line_number,
            column: null,
            rule: result.test_id,
            source: 'bandit',
            remediation: result.more_info || 'Review and fix the security issue',
            cve: null,
          });
        }
      }

      return issues;
    } catch (error) {
      SecurityUtils.safeErrorLog('Bandit analysis failed', error);
      return [];
    }
  }

  private async runSafety(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    try {
      // Run Safety to check Python dependencies for known vulnerabilities
      const { stdout } = await execAsync(`python3 -m safety check --json --full-report`, {
        cwd: directory,
        timeout: 120000, // 2 minute timeout
      }).catch(error => {
        return { stdout: error.stdout || '[]' };
      });

      const results = JSON.parse(stdout || '[]');
      const issues: Omit<Issue, 'id' | 'scanId'>[] = [];

      for (const result of results) {
        if (result.vulnerability) {
          issues.push({
            severity: this.mapSafetySeverity(result.vulnerability.severity || 'UNKNOWN'),
            title: `${result.package_name}: ${result.vulnerability.id}`,
            description: result.vulnerability.summary,
            file: 'requirements.txt / setup.py',
            line: null,
            column: null,
            rule: result.vulnerability.id,
            source: 'safety',
            remediation: result.vulnerability.fixed_in ? 
              `Update ${result.package_name} to version ${result.vulnerability.fixed_in}` : 
              `Update ${result.package_name} to a secure version`,
            cve: result.vulnerability.cve || null,
          });
        }
      }

      return issues;
    } catch (error) {
      SecurityUtils.safeErrorLog('Safety check failed', error);
      return [];
    }
  }

  private async runDeepAnalysis(directory: string): Promise<Omit<Issue, 'id' | 'scanId'>[]> {
    // Placeholder for additional deep analysis tools
    // Could integrate with CodeQL, additional language-specific tools, etc.
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

  private mapSemgrepSeverity(semgrepSeverity: string): 'high' | 'medium' | 'low' {
    switch (semgrepSeverity?.toUpperCase()) {
      case 'ERROR':
      case 'HIGH':
        return 'high';
      case 'WARNING':
      case 'MEDIUM':
        return 'medium';
      case 'INFO':
      case 'LOW':
      default:
        return 'low';
    }
  }

  private mapTrivySeverity(trivySeverity: string): 'high' | 'medium' | 'low' {
    switch (trivySeverity?.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
      case 'UNKNOWN':
      case 'NEGLIGIBLE':
      default:
        return 'low';
    }
  }

  private mapBanditSeverity(banditSeverity: string): 'high' | 'medium' | 'low' {
    switch (banditSeverity?.toUpperCase()) {
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
      default:
        return 'low';
    }
  }

  private mapSafetySeverity(safetySeverity: string): 'high' | 'medium' | 'low' {
    switch (safetySeverity?.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
      case 'MODERATE':
        return 'medium';
      case 'LOW':
      case 'UNKNOWN':
      default:
        return 'low';
    }
  }
}
