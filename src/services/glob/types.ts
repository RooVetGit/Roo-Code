//src/services/glob/types.ts
export interface FileNode {
	name: string
	type: "file"
	extension?: string
	category?: string
}

export interface DirectoryNode {
	name: string
	type: "directory"
	children: Record<string, FileNode | DirectoryNode>
}

export type FileSystemNode = FileNode | DirectoryNode

export interface TreeResult {
	root: FileSystemNode
	hasMore: boolean
}

export interface ListFilesOptions {
    path: string;
	recursive?: boolean
	limit: number
	format?: "flat" | "tree"
}

export type ListFilesResult<T extends "flat" | "tree"> = T extends "flat"
	? [string[], boolean]
	: [{ root: FileSystemNode; hasMore: boolean }, boolean]
