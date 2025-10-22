import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GitHubService } from "./services/github";
import { ScannerService } from "./services/scanner";
import { RemediationService } from "./services/remediation";
import { GitHubPRService } from "./services/github-pr";
import { SecurityUtils } from "./utils/security";
import { insertScanSchema, scanOptionsSchema, insertModelSettingsSchema } from "@shared/schema";
import { z } from "zod";
import os from "os";
import path from "path";
import crypto from "crypto";

const githubService = new GitHubService();
const scannerService = new ScannerService();
const remediationService = new RemediationService();
const githubPRService = new GitHubPRService();

// Store active scans for progress tracking
const activeScans = new Map<string, { status: string; progress: number; currentStep: string | null }>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all scans
  app.get("/api/scans", async (req, res) => {
    try {
      const scans = await storage.getScans();
      res.json(scans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scans" });
    }
  });

  // Get single scan with issues
  app.get("/api/scans/:id", async (req, res) => {
    try {
      const scanId = SecurityUtils.validateScanId(req.params.id);
      const scan = await storage.getScan(scanId);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      const issues = await storage.getIssuesByScan(scan.id);
      res.json({ ...scan, issues });
    } catch (error) {
      SecurityUtils.safeErrorLog("Failed to fetch scan", error);
      res.status(500).json({ message: "Failed to fetch scan" });
    }
  });

  // Create new scan
  app.post("/api/scans", async (req, res) => {
    try {
      const requestSchema = z.object({
        repositoryUrl: z.string().url(),
        scanOptions: scanOptionsSchema,
      });
      
      const body = requestSchema.parse(req.body);

      // Validate GitHub URL
      const repository = await githubService.validateAndParseUrl(body.repositoryUrl);
      
      // Create scan record
      const scan = await storage.createScan({
        repositoryUrl: body.repositoryUrl,
        repositoryName: repository.fullName,
        status: "pending",
        scanOptions: body.scanOptions,
      });

      // Initialize active scan tracking
      activeScans.set(scan.id, {
        status: "pending",
        progress: 0,
        currentStep: null,
      });

      // Start scan asynchronously
      performScan(scan.id, repository, body.scanOptions).catch(error => {
        console.error("Scan failed:", error);
        storage.updateScan(scan.id, {
          status: "failed",
          completedAt: new Date(),
        });
        activeScans.delete(scan.id);
      });

      res.json(scan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request body", errors: error.errors });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create scan" });
    }
  });

  // Get scan progress
  app.get("/api/scans/:id/progress", async (req, res) => {
    try {
      const scanId = req.params.id;
      const activeScan = activeScans.get(scanId);
      
      if (activeScan) {
        res.json(activeScan);
      } else {
        const scan = await storage.getScan(scanId);
        if (!scan) {
          return res.status(404).json({ message: "Scan not found" });
        }
        
        res.json({
          status: scan.status,
          progress: scan.progress || 0,
          currentStep: scan.currentStep,
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scan progress" });
    }
  });

  // Cancel scan
  app.post("/api/scans/:id/cancel", async (req, res) => {
    try {
      const scanId = req.params.id;
      activeScans.delete(scanId);
      
      await storage.updateScan(scanId, {
        status: "failed",
        completedAt: new Date(),
      });

      res.json({ message: "Scan cancelled" });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel scan" });
    }
  });



  // Model settings routes
  app.get("/api/model-settings", async (req, res) => {
    try {
      const settings = await storage.getAllModelSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch model settings" });
    }
  });

  app.post("/api/model-settings", async (req, res) => {
    try {
      const validated = insertModelSettingsSchema.parse(req.body);
      const settings = await storage.createModelSettings(validated);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request body", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create model settings" });
    }
  });

  app.patch("/api/model-settings/:id", async (req, res) => {
    try {
      const settingId = req.params.id;
      const settings = await storage.updateModelSettings(settingId, req.body);
      if (!settings) {
        return res.status(404).json({ message: "Model settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to update model settings" });
    }
  });

  app.delete("/api/model-settings/:id", async (req, res) => {
    try {
      const settingId = req.params.id;
      await storage.deleteModelSettings(settingId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete model settings" });
    }
  });

  // Remediate issue
  app.post("/api/issues/:id/remediate", async (req, res) => {
    try {
      const issueId = req.params.id;
      const issue = await storage.getIssue(issueId);
      
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      const scan = await storage.getScan(issue.scanId);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Get model settings
      const modelSettings = await storage.getDefaultModelSettings();
      if (!modelSettings) {
        return res.status(400).json({ message: "No default model configured. Please configure a model first." });
      }

      // Clone repository again for remediation
      const repository = await githubService.validateAndParseUrl(scan.repositoryUrl);
      const tempDir = path.join(os.tmpdir(), `scan-${crypto.randomBytes(8).toString('hex')}`);
      const repoPath = await githubService.cloneRepository(repository, tempDir);

      try {
        const result = await remediationService.remediateIssue(issue, repoPath, modelSettings);
        
        if (result.success) {
          await storage.updateIssue(issueId, {
            remediationStatus: "success",
            remediatedCode: result.fixedCode,
            remediatedAt: new Date(),
          });

          res.json({
            success: true,
            diff: result.diff,
            explanation: result.explanation,
          });
        } else {
          await storage.updateIssue(issueId, {
            remediationStatus: "failed",
            remediatedAt: new Date(),
          });

          res.status(400).json({
            success: false,
            error: result.error,
          });
        }
      } finally {
        await githubService.cleanup(tempDir);
      }
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to remediate issue" 
      });
    }
  });

  // Create PR for remediated issue
  app.post("/api/issues/:id/create-pr", async (req, res) => {
    try {
      const issueId = req.params.id;
      const issue = await storage.getIssue(issueId);
      
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      if (!issue.remediatedCode || issue.remediationStatus !== "success") {
        return res.status(400).json({ message: "Issue must be successfully remediated before creating a PR" });
      }

      const scan = await storage.getScan(issue.scanId);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      const repoInfo = githubPRService.parseRepoUrl(scan.repositoryUrl);
      if (!repoInfo) {
        return res.status(400).json({ message: "Invalid repository URL" });
      }

      // Clone repository
      const repository = await githubService.validateAndParseUrl(scan.repositoryUrl);
      const tempDir = path.join(os.tmpdir(), `pr-${crypto.randomBytes(8).toString('hex')}`);
      const repoPath = await githubService.cloneRepository(repository, tempDir);

      try {
        // Get authenticated user for git config
        const user = await githubPRService.getAuthenticatedUser();
        await githubPRService.setupGitUser(
          repoPath,
          user.name || user.login,
          `${user.login}@users.noreply.github.com`
        );

        // Apply fix to file
        if (!issue.file) {
          throw new Error("Issue must have an associated file to create a PR");
        }

        // Validate file path to prevent path traversal
        const sanitizedFilePath = SecurityUtils.validatePath(repoPath, path.join(repoPath, issue.file));
        const relativeFilePath = path.relative(repoPath, sanitizedFilePath);
        
        await remediationService.applyFix(repoPath, relativeFilePath, issue.remediatedCode);

        // Create branch and commit
        const branchName = `fix/${issue.severity}-${issue.id.substring(0, 8)}`;
        const commitMessage = `Fix: ${issue.title}\n\n${issue.description}`;
        
        await githubPRService.createBranchAndCommit(
          repoPath,
          branchName,
          commitMessage,
          relativeFilePath
        );

        // Push branch
        await githubPRService.pushBranch(repoPath, branchName);

        // Create PR
        const prTitle = `🔒 Security Fix: ${issue.title}`;
        const prBody = `## Security Issue Remediation
        
**Severity:** ${issue.severity.toUpperCase()}
**Source:** ${issue.source}
${issue.cve ? `**CVE:** ${issue.cve}` : ''}

### Description
${issue.description}

### Changes Made
This PR automatically fixes the security issue identified by SecureScan.

${issue.remediation ? `### Remediation
${issue.remediation}` : ''}

---
*This PR was automatically generated by SecureScan*`;

        const pr = await githubPRService.createPullRequest({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          title: prTitle,
          body: prBody,
          head: branchName,
          base: repository.defaultBranch,
        });

        // Update issue with PR info
        await storage.updateIssue(issueId, {
          prUrl: pr.htmlUrl,
          prNumber: pr.number,
        });

        res.json({
          success: true,
          prUrl: pr.htmlUrl,
          prNumber: pr.number,
        });
      } finally {
        await githubService.cleanup(tempDir);
      }
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create PR" 
      });
    }
  });

  async function performScan(scanId: string, repository: any, scanOptions: any) {
    // Validate and sanitize input
    const validatedScanId = SecurityUtils.validateScanId(scanId);
    const secureDirectory = SecurityUtils.generateSecureDirectory('secure-scan', validatedScanId);
    
    // Secure path creation with validation
    const baseTempDir = os.tmpdir();
    const tempDir = SecurityUtils.validatePath(baseTempDir, path.join(baseTempDir, secureDirectory));
    
    try {
      // Update scan status
      await storage.updateScan(scanId, {
        status: "scanning",
        currentStep: "Cloning repository...",
        progress: 10,
      });
      activeScans.set(scanId, {
        status: "scanning",
        progress: 10,
        currentStep: "Cloning repository...",
      });

      // Clone repository
      const repoPath = await githubService.cloneRepository(repository, tempDir);

      // Run scans with progress callback
      const onProgress = async (step: string, progress: number) => {
        await storage.updateScan(scanId, {
          currentStep: step,
          progress,
        });
        activeScans.set(scanId, {
          status: "scanning",
          progress,
          currentStep: step,
        });
      };

      const scanResult = await scannerService.scanDirectory(repoPath, scanOptions, onProgress);

      // Save issues to storage
      await storage.deleteIssuesByScan(scanId); // Clear any existing issues
      for (const issue of scanResult.issues) {
        await storage.createIssue({
          ...issue,
          scanId,
        });
      }

      // Mark scan as completed
      await storage.updateScan(scanId, {
        status: "completed",
        progress: 100,
        currentStep: null,
        completedAt: new Date(),
      });

      activeScans.delete(scanId);
    } catch (error) {
      SecurityUtils.safeErrorLog("Scan failed", error);
      await storage.updateScan(scanId, {
        status: "failed",
        completedAt: new Date(),
      });
      activeScans.delete(scanId);
      throw error;
    } finally {
      // Cleanup cloned repository
      await githubService.cleanup(tempDir);
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
