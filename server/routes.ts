import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GitHubService } from "./services/github";
import { ScannerService } from "./services/scanner";
import { insertScanSchema, scanOptionsSchema } from "@shared/schema";
import { z } from "zod";
import os from "os";
import path from "path";

const githubService = new GitHubService();
const scannerService = new ScannerService();

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
      const scan = await storage.getScan(req.params.id);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      const issues = await storage.getIssuesByScan(scan.id);
      res.json({ ...scan, issues });
    } catch (error) {
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

  async function performScan(scanId: string, repository: any, scanOptions: any) {
    const tempDir = path.join(os.tmpdir(), `secure-scan-${scanId}`);
    
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
      console.error("Scan error:", error);
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
