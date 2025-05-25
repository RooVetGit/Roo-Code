import { Octokit } from "@octokit/rest";
import { Task } from "../../task/Task";
import { formatResponse } from "../../prompts/responses";
import { getGitHubRepoInfo } from "../../../utils/git"; 

export interface CreateGitHubPullRequestParams {
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
  repoOwner?: string;
  repoName?: string;
}

export async function createGitHubPullRequestTool(
  task: Task,
  params: CreateGitHubPullRequestParams
): Promise<string> {
  task.recordToolUsage("createGitHubPullRequestTool");

  const { title, body, headBranch, baseBranch } = params;
  let { repoOwner, repoName } = params;

  if (!task.apiConfiguration.gitHubPat) {
    const errorMsg = "GitHub PAT not configured. Please add `gitHubPat` to your API configuration.";
    task.recordToolError("createGitHubPullRequestTool", errorMsg);
    return formatResponse.toolError(errorMsg);
  }

  // Phase 2: Infer Repository Info (if needed)
  // For now, we'll assume repoOwner and repoName are provided if needed,
  // or we'll return an error if they are essential and missing.
  if (!repoOwner || !repoName) {
    // Placeholder for Phase 2: Attempt to infer from git remote
    // For now, if not provided, return an error or attempt a fallback if sensible.
    // This part will be enhanced in Phase 2.
    // For now, let's assume if they are not provided, we cannot proceed.
    // In a real scenario, we'd call something like:
    // const gitInfo = await getGitHubRepoInfo(task.cwd, task);
    // if (gitInfo) {
    //   repoOwner = repoOwner || gitInfo.owner;
    //   repoName = repoName || gitInfo.repo;
    // }
    
    if (!repoOwner || !repoName) {
        const errorMsg = "Repository owner and name not provided and automatic inference is not yet implemented. Please provide `repoOwner` and `repoName`.";
        task.recordToolError("createGitHubPullRequestTool", errorMsg);
        return formatResponse.toolError(errorMsg);
    }
  }

  try {
    const octokit = new Octokit({ auth: task.apiConfiguration.gitHubPat });

    const response = await octokit.rest.pulls.create({
      owner: repoOwner,
      repo: repoName,
      title,
      head: headBranch,
      base: baseBranch,
      body,
    });

    if (response.status === 201 && response.data.html_url) {
      return `<github_pull_request_created>
<url>${response.data.html_url}</url>
<number>${response.data.number}</number>
<title>${title}</title>
<head_branch>${headBranch}</head_branch>
<base_branch>${baseBranch}</base_branch>
</github_pull_request_created>`;
    } else {
      const errorMsg = `Failed to create GitHub pull request. Status: ${response.status}`;
      task.recordToolError("createGitHubPullRequestTool", errorMsg);
      return formatResponse.toolError(errorMsg);
    }
  } catch (error: any) {
    const errorMsg = `GitHub API Error: ${error.message || "Unknown error"}`;
    task.recordToolError("createGitHubPullRequestTool", errorMsg);
    console.error("GitHub API Error in createGitHubPullRequestTool:", error);
    return formatResponse.toolError(errorMsg);
  }
}
