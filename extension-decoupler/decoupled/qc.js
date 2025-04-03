
var qC = class e {
	constructor(t, r, n, i = [], s = [], o, a) {
		this.blobs = t
		this.recentChunks = r
		this.trackedPaths = n
		this.unindexedEditEvents = i
		this.unindexedEditEventsBaseBlobNames = s
		this.lastChatResponse = o
		this.blobNames = a
	}
	static empty() {
		return new e(
			{ checkpointId: void 0, addedBlobs: [], deletedBlobs: [] },
			new Array(),
			new Map(),
			[],
			[],
			void 0,
			[],
		)
	}
}