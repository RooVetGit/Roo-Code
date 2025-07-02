export interface RepoConfig {
	name: string
	path: string
	description?: string
}

export const REPO_CONFIGS: RepoConfig[] = [
	{
		name: "Roo-Code",
		path: "/roo/repos/Roo-Code",
		description: "Main Roo Code repository",
	},
	{
		name: "Roo-Code-Cloud",
		path: "/roo/repos/Roo-Code-Cloud",
		description: "Roo Code Cloud repository",
	},
]

export const getRepoConfig = (repoPath: string): RepoConfig | undefined => {
	return REPO_CONFIGS.find((config) => config.path === repoPath)
}

export const getRepoConfigByName = (name: string): RepoConfig | undefined => {
	return REPO_CONFIGS.find((config) => config.name === name)
}
