import { Issue } from "@shared/schema";
import { LLMService, LLMMessage } from "./llm";
import { ModelSettings } from "@shared/schema";
import fs from "fs/promises";
import path from "path";

export interface RemediationResult {
  success: boolean;
  originalCode?: string;
  fixedCode?: string;
  diff?: string;
  explanation?: string;
  error?: string;
}

export class RemediationService {
  private llmService: LLMService;

  constructor() {
    this.llmService = new LLMService();
  }

  async remediateIssue(issue: Issue, repoPath: string, modelSettings: ModelSettings): Promise<RemediationResult> {
    try {
      if (!issue.file) {
        return {
          success: false,
          error: "Issue does not have an associated file",
        };
      }

      const filePath = path.join(repoPath, issue.file);
      
      let originalCode: string;
      try {
        originalCode = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        return {
          success: false,
          error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

      const messages: LLMMessage[] = [
        {
          role: "system",
          content: `You are a senior software engineer specialized in code security and quality. Your task is to fix security vulnerabilities and code quality issues while ensuring:
1. The fix does not break existing functionality
2. The code remains readable and maintainable
3. All imports and dependencies are preserved
4. The fix addresses the root cause, not just the symptom
5. You return ONLY the complete fixed file content, nothing else

Respond with ONLY the complete fixed code, no explanations or markdown formatting.`,
        },
        {
          role: "user",
          content: this.buildRemediationPrompt(issue, originalCode),
        },
      ];

      const llmResponse = await this.llmService.chat(messages, modelSettings);
      const fixedCode = this.cleanLLMResponse(llmResponse.content);

      if (!fixedCode || fixedCode.trim().length === 0) {
        return {
          success: false,
          error: "LLM returned empty response",
        };
      }

      const diff = this.generateDiff(originalCode, fixedCode, issue.file);
      
      return {
        success: true,
        originalCode,
        fixedCode,
        diff,
        explanation: `Fixed ${issue.severity} severity issue: ${issue.title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private buildRemediationPrompt(issue: Issue, code: string): string {
    let prompt = `Fix the following security/quality issue in this code:\n\n`;
    prompt += `Issue: ${issue.title}\n`;
    prompt += `Severity: ${issue.severity}\n`;
    prompt += `Description: ${issue.description}\n`;
    
    if (issue.remediation) {
      prompt += `Suggested Remediation: ${issue.remediation}\n`;
    }
    
    if (issue.rule) {
      prompt += `Rule: ${issue.rule}\n`;
    }
    
    if (issue.line) {
      prompt += `Location: Line ${issue.line}`;
      if (issue.column) {
        prompt += `, Column ${issue.column}`;
      }
      prompt += `\n`;
    }

    if (issue.cve) {
      prompt += `CVE: ${issue.cve}\n`;
    }

    prompt += `\nFile: ${issue.file}\n`;
    prompt += `\nOriginal Code:\n\`\`\`\n${code}\n\`\`\`\n\n`;
    prompt += `Provide the complete fixed version of this file. Return ONLY the code, no explanations.`;

    return prompt;
  }

  private cleanLLMResponse(response: string): string {
    let cleaned = response.trim();
    
    // Remove markdown code blocks if present
    const codeBlockRegex = /^```[\w]*\n([\s\S]*?)\n```$/;
    const match = cleaned.match(codeBlockRegex);
    if (match) {
      cleaned = match[1];
    }

    // Remove leading/trailing backticks
    cleaned = cleaned.replace(/^`+|`+$/g, '');

    return cleaned.trim();
  }

  private generateDiff(original: string, fixed: string, filename: string): string {
    const originalLines = original.split('\n');
    const fixedLines = fixed.split('\n');
    
    let diff = `--- a/${filename}\n+++ b/${filename}\n`;
    
    const maxLines = Math.max(originalLines.length, fixedLines.length);
    let hunkStart = -1;
    let hunkLines: string[] = [];
    
    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const fixedLine = fixedLines[i];
      
      if (origLine !== fixedLine) {
        if (hunkStart === -1) {
          hunkStart = i;
        }
        
        if (origLine !== undefined) {
          hunkLines.push(`-${origLine}`);
        }
        if (fixedLine !== undefined) {
          hunkLines.push(`+${fixedLine}`);
        }
      } else if (hunkStart !== -1 && hunkLines.length > 0) {
        // End of current hunk
        const contextBefore = Math.max(0, hunkStart - 3);
        const contextAfter = Math.min(originalLines.length - 1, i + 2);
        
        diff += `@@ -${contextBefore + 1},${i - contextBefore} +${contextBefore + 1},${i - contextBefore} @@\n`;
        
        for (let j = contextBefore; j < hunkStart; j++) {
          diff += ` ${originalLines[j]}\n`;
        }
        
        diff += hunkLines.join('\n') + '\n';
        
        for (let j = i; j <= contextAfter && j < originalLines.length; j++) {
          diff += ` ${originalLines[j]}\n`;
        }
        
        hunkStart = -1;
        hunkLines = [];
      }
    }
    
    // Handle final hunk if exists
    if (hunkStart !== -1 && hunkLines.length > 0) {
      diff += `@@ -${hunkStart + 1},${originalLines.length - hunkStart} +${hunkStart + 1},${fixedLines.length - hunkStart} @@\n`;
      diff += hunkLines.join('\n') + '\n';
    }
    
    return diff;
  }

  async applyFix(repoPath: string, filePath: string, fixedCode: string): Promise<void> {
    const fullPath = path.join(repoPath, filePath);
    await fs.writeFile(fullPath, fixedCode, 'utf-8');
  }
}
