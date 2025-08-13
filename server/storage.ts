import { type Scan, type InsertScan, type Issue, type InsertIssue } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Scan operations
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: string): Promise<Scan | undefined>;
  updateScan(id: string, updates: Partial<Scan>): Promise<Scan | undefined>;
  getScans(limit?: number): Promise<Scan[]>;
  
  // Issue operations
  createIssue(issue: InsertIssue): Promise<Issue>;
  getIssuesByScan(scanId: string): Promise<Issue[]>;
  deleteIssuesByScan(scanId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private scans: Map<string, Scan>;
  private issues: Map<string, Issue>;

  constructor() {
    this.scans = new Map();
    this.issues = new Map();
  }

  async createScan(insertScan: InsertScan): Promise<Scan> {
    const id = randomUUID();
    const scan: Scan = {
      ...insertScan,
      id,
      status: insertScan.status || "pending",
      createdAt: new Date(),
      completedAt: null,
      progress: 0,
      currentStep: null,
    };
    this.scans.set(id, scan);
    return scan;
  }

  async getScan(id: string): Promise<Scan | undefined> {
    return this.scans.get(id);
  }

  async updateScan(id: string, updates: Partial<Scan>): Promise<Scan | undefined> {
    const scan = this.scans.get(id);
    if (!scan) return undefined;
    
    const updatedScan = { ...scan, ...updates };
    this.scans.set(id, updatedScan);
    return updatedScan;
  }

  async getScans(limit = 50): Promise<Scan[]> {
    return Array.from(this.scans.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createIssue(insertIssue: InsertIssue): Promise<Issue> {
    const id = randomUUID();
    const issue: Issue = { 
      ...insertIssue, 
      id,
      line: insertIssue.line ?? null,
      column: insertIssue.column ?? null,
      file: insertIssue.file ?? null,
      rule: insertIssue.rule ?? null,
      remediation: insertIssue.remediation ?? null,
      cve: insertIssue.cve ?? null,
    };
    this.issues.set(id, issue);
    return issue;
  }

  async getIssuesByScan(scanId: string): Promise<Issue[]> {
    return Array.from(this.issues.values())
      .filter(issue => issue.scanId === scanId)
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return (severityOrder[b.severity as keyof typeof severityOrder] || 0) - 
               (severityOrder[a.severity as keyof typeof severityOrder] || 0);
      });
  }

  async deleteIssuesByScan(scanId: string): Promise<void> {
    const entriesToDelete = Array.from(this.issues.entries())
      .filter(([, issue]) => issue.scanId === scanId);
    
    for (const [id] of entriesToDelete) {
      this.issues.delete(id);
    }
  }
}

export const storage = new MemStorage();
