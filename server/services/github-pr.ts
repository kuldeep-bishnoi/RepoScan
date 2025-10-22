import { Octokit } from '@octokit/rest';
import simpleGit, { SimpleGit } from 'simple-git';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export interface CreatePROptions {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

export interface PRResult {
  number: number;
  url: string;
  htmlUrl: string;
}

export class GitHubPRService {
  async createPullRequest(options: CreatePROptions): Promise<PRResult> {
    try {
      const octokit = await getUncachableGitHubClient();
      
      const response = await octokit.rest.pulls.create({
        owner: options.owner,
        repo: options.repo,
        title: options.title,
        body: options.body,
        head: options.head,
        base: options.base,
      });

      return {
        number: response.data.number,
        url: response.data.url,
        htmlUrl: response.data.html_url,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create PR: ${error.message}`);
      }
      throw new Error('Failed to create PR: Unknown error');
    }
  }

  async createBranchAndCommit(
    repoPath: string,
    branchName: string,
    commitMessage: string,
    filePath: string
  ): Promise<void> {
    try {
      // Sanitize branch name: remove special characters, limit length
      const safeBranchName = branchName
        .replace(/[^a-zA-Z0-9\-_\/]/g, '-')
        .substring(0, 100);
      
      const git: SimpleGit = simpleGit(repoPath);
      
      // Create and checkout new branch
      await git.checkoutLocalBranch(safeBranchName);
      
      // Add the specific file
      await git.add(filePath);
      
      // Commit with message
      await git.commit(commitMessage);
    } catch (error) {
      throw new Error(`Failed to create branch and commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pushBranch(repoPath: string, branchName: string): Promise<void> {
    try {
      // Sanitize branch name
      const safeBranchName = branchName
        .replace(/[^a-zA-Z0-9\-_\/]/g, '-')
        .substring(0, 100);
      
      const git: SimpleGit = simpleGit(repoPath);
      await git.push('origin', safeBranchName);
    } catch (error) {
      throw new Error(`Failed to push branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAuthenticatedUser(): Promise<{ login: string; name: string | null }> {
    try {
      const octokit = await getUncachableGitHubClient();
      const response = await octokit.rest.users.getAuthenticated();
      
      return {
        login: response.data.login,
        name: response.data.name,
      };
    } catch (error) {
      throw new Error(`Failed to get authenticated user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  parseRepoUrl(url: string): { owner: string; repo: string } | null {
    const githubUrlRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?(?:\/.*)?$/;
    const match = url.match(githubUrlRegex);
    
    if (!match) {
      return null;
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");
    
    return { owner, repo: cleanRepo };
  }

  async setupGitUser(repoPath: string, userName: string, userEmail: string): Promise<void> {
    try {
      const git: SimpleGit = simpleGit(repoPath);
      await git.addConfig('user.name', userName);
      await git.addConfig('user.email', userEmail);
    } catch (error) {
      throw new Error(`Failed to setup git user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
