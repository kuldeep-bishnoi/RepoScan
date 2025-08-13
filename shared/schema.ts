import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scans = pgTable("scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repositoryUrl: text("repository_url").notNull(),
  repositoryName: text("repository_name").notNull(),
  status: text("status").notNull().default("pending"), // pending, scanning, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  progress: integer("progress").default(0),
  currentStep: text("current_step"),
  scanOptions: jsonb("scan_options").notNull(),
});

export const issues = pgTable("issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scanId: varchar("scan_id").references(() => scans.id).notNull(),
  severity: text("severity").notNull(), // high, medium, low
  title: text("title").notNull(),
  description: text("description").notNull(),
  file: text("file"),
  line: integer("line"),
  column: integer("column"),
  rule: text("rule"),
  source: text("source").notNull(), // eslint, npm-audit, security-patterns, semgrep, trivy, secret-scan, bandit, safety
  remediation: text("remediation"),
  cve: text("cve"),
});

export const insertScanSchema = createInsertSchema(scans).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  progress: true,
  currentStep: true,
});

export const insertIssueSchema = createInsertSchema(issues).omit({
  id: true,
});

export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scans.$inferSelect;
export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type Issue = typeof issues.$inferSelect;

// Extended types for API responses
export type ScanWithIssues = Scan & { issues: Issue[] };

export const scanOptionsSchema = z.object({
  eslint: z.boolean().default(true),
  npmAudit: z.boolean().default(true),
  securityPatterns: z.boolean().default(true),
  semgrep: z.boolean().default(true),
  trivy: z.boolean().default(true),
  secretScan: z.boolean().default(true),
  bandit: z.boolean().default(true),
  safety: z.boolean().default(true),
  deepAnalysis: z.boolean().default(false),
});

export type ScanOptions = z.infer<typeof scanOptionsSchema>;
