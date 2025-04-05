import * as vscode from "vscode"

//https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts
interface GitRepository {
	diff(staged: boolean): Promise<string>
	readonly inputBox: { value: string }
	readonly state: {
		readonly indexChanges: GitFileChange[]
	}
}

interface GitFileChange {
	readonly status: number
	readonly uri: vscode.Uri
}

export enum Status {
	INDEX_MODIFIED = 0,
	INDEX_ADDED = 1,
	INDEX_DELETED = 2,
	INDEX_RENAMED = 3,
	INDEX_COPIED = 4,
}

export function getRepo(): GitRepository | null {
	const gitExtension = vscode.extensions.getExtension("vscode.git")
	return gitExtension?.exports?.getAPI(1)?.repositories?.[0] ?? null
}

export async function getStagedDiff(repository: GitRepository): Promise<string> {
	return await repository.diff(true)
}

export function getStagedStatus(repo: GitRepository): string {
	return repo.state.indexChanges
		.map((change) => {
			const status = getStatusSymbol(change.status)
			return `${status} - ${change.uri.fsPath}`
		})
		.join("\n")
}

function getStatusSymbol(status: Status): string {
	switch (status) {
		case Status.INDEX_MODIFIED:
			return "M"
		case Status.INDEX_ADDED:
			return "A"
		case Status.INDEX_DELETED:
			return "D"
		case Status.INDEX_RENAMED:
			return "R"
		case Status.INDEX_COPIED:
			return "C"
		default:
			return "?"
	}
}
