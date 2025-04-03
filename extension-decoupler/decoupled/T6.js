
var t6 = class {
	constructor(t, r, n, i, s) {
		this.blobStatusStore = t
		this.fileEditProcessor = r
		this.fileChangeSizeCounter = n
		this.workspaceName = i
		this.folderId = s
	}
	dispose() {
		this.blobStatusStore.clear()
	}
}