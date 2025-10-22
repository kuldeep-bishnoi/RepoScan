import { type Scan, type InsertScan, type Issue, type InsertIssue, type ModelSettings, type InsertModelSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Scan operations
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: string): Promise<Scan | undefined>;
  updateScan(id: string, updates: Partial<Scan>): Promise<Scan | undefined>;
  getScans(limit?: number): Promise<Scan[]>;
  
  // Issue operations
  createIssue(issue: InsertIssue): Promise<Issue>;
  getIssue(id: string): Promise<Issue | undefined>;
  updateIssue(id: string, updates: Partial<Issue>): Promise<Issue | undefined>;
  getIssuesByScan(scanId: string): Promise<Issue[]>;
  deleteIssuesByScan(scanId: string): Promise<void>;

  // Model settings operations
  createModelSettings(settings: InsertModelSettings): Promise<ModelSettings>;
  getModelSettings(id: string): Promise<ModelSettings | undefined>;
  getAllModelSettings(): Promise<ModelSettings[]>;
  getDefaultModelSettings(): Promise<ModelSettings | undefined>;
  updateModelSettings(id: string, updates: Partial<ModelSettings>): Promise<ModelSettings | undefined>;
  deleteModelSettings(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private scans: Map<string, Scan>;
  private issues: Map<string, Issue>;
  private modelSettings: Map<string, ModelSettings>;

  constructor() {
    this.scans = new Map();
    this.issues = new Map();
    this.modelSettings = new Map();
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
      remediationStatus: null,
      remediatedCode: null,
      prUrl: null,
      prNumber: null,
      remediatedAt: null,
    };
    this.issues.set(id, issue);
    return issue;
  }

  async getIssue(id: string): Promise<Issue | undefined> {
    return this.issues.get(id);
  }

  async updateIssue(id: string, updates: Partial<Issue>): Promise<Issue | undefined> {
    const issue = this.issues.get(id);
    if (!issue) return undefined;
    
    const updatedIssue = { ...issue, ...updates };
    this.issues.set(id, updatedIssue);
    return updatedIssue;
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

  async createModelSettings(insertSettings: InsertModelSettings): Promise<ModelSettings> {
    const id = randomUUID();
    const settings: ModelSettings = {
      ...insertSettings,
      id,
      endpoint: insertSettings.endpoint ?? null,
      apiKey: insertSettings.apiKey ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.modelSettings.set(id, settings);
    return settings;
  }

  async getModelSettings(id: string): Promise<ModelSettings | undefined> {
    return this.modelSettings.get(id);
  }

  async getAllModelSettings(): Promise<ModelSettings[]> {
    return Array.from(this.modelSettings.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getDefaultModelSettings(): Promise<ModelSettings | undefined> {
    return Array.from(this.modelSettings.values())
      .find(settings => settings.isDefault === "true");
  }

  async updateModelSettings(id: string, updates: Partial<ModelSettings>): Promise<ModelSettings | undefined> {
    const settings = this.modelSettings.get(id);
    if (!settings) return undefined;
    
    const updatedSettings = { ...settings, ...updates, updatedAt: new Date() };
    this.modelSettings.set(id, updatedSettings);
    return updatedSettings;
  }

  async deleteModelSettings(id: string): Promise<void> {
    this.modelSettings.delete(id);
  }
}

export const storage = new MemStorage();
