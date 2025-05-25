import { ToolDefinition } from "../../../../../src/shared/tools" // Adjusted path

export const createGitHubPullRequestToolDefinition: ToolDefinition = {
	name: "createGitHubPullRequestTool",
	description: "Creates a new GitHub pull request. Requires the current branch to have changes pushed to a remote repository. Best used after committing changes with `git commit` and pushing with `git push`.",
	parameters: [
		{
			name: "title",
			type: "string",
			description: "The title of the pull request.",
			required: true,
		},
		{
			name: "body",
			type: "string",
			description: "The body/description of the pull request.",
			required: true,
		},
		{
			name: "headBranch",
			type: "string",
			description: "The name of the branch where your changes are implemented.",
			required: true,
		},
		{
			name: "baseBranch",
			type: "string",
			description: "The name of the branch you want the changes pulled into.",
			required: true,
		},
		{
			name: "repoOwner",
			type: "string",
			description: "The owner of the repository. If not provided, it will be inferred from the git remote.",
			required: false,
		},
		{
			name: "repoName",
			type: "string",
			description: "The name of the repository. If not provided, it will be inferred from the git remote.",
			required: false,
		},
	],
}
