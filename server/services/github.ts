import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { SecurityUtils } from "../utils/security";

const execAsync = promisify(exec);

export interface GitHubRepository {
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  isPublic: boolean;
}

export class GitHubService {

  async validateAndParseUrl(url: string): Promise<GitHubRepository> {
    const githubUrlRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?(?:\/.*)?$/;
    const match = url.match(githubUrlRegex);
    
    if (!match) {
      throw new Error("Invalid GitHub URL format");
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");
    const fullName = `${owner}/${cleanRepo}`;

    // Try to fetch repository info from GitHub API
    try {
      const response = await fetch(`https://api.github.com/repos/${fullName}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Repository not found or is private");
        }
        throw new Error("Failed to access repository");
      }

      const repoData = await response.json();
      
      return {
        name: repoData.name,
        fullName: repoData.full_name,
        url: repoData.clone_url,
        defaultBranch: repoData.default_branch,
        isPublic: !repoData.private,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to validate repository");
    }
  }

  async cloneRepository(repository: GitHubRepository, targetDir: string): Promise<string> {
    // First validate the target directory is safe
    const sanitizedTargetDir = path.resolve(targetDir);
    
    // Generate secure directory name and validate the full path
    const secureDirectoryName = SecurityUtils.generateSecureDirectory(repository.name);
    const proposedPath = path.join(sanitizedTargetDir, secureDirectoryName);
    const cloneDir = SecurityUtils.validatePath(sanitizedTargetDir, proposedPath);
    
    try {
      // Remove directory if it exists
      await fs.rm(cloneDir, { recursive: true, force: true });
      
      // Clone repository
      await execAsync(`git clone --depth=1 ${repository.url} ${cloneDir}`);
      
      return cloneDir;
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(directory: string): Promise<void> {
    try {
      await fs.rm(directory, { recursive: true, force: true });
    } catch (error) {
      SecurityUtils.safeErrorLog('Failed to cleanup directory', error);
    }
  }
}
