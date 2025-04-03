
var $1 = class e extends Zn {
	constructor(r, n, i, s) {
		super("NextEditResolutionReporter", n ?? e.defaultMaxRecords, i ?? e.defaultUploadMsec, s ?? e.defaultBatchSize)
		this._apiServer = r
	}
	static defaultMaxRecords = 1e4
	static defaultBatchSize = 1e3
	static defaultUploadMsec = 1e4
	reportResolution(r, n, i, s) {
		let [o, a] = kn(n),
			[l, c] = kn(i)
		this.report({
			request_id: r,
			emit_time_sec: o,
			emit_time_nsec: a,
			resolve_time_sec: l,
			resolve_time_nsec: c,
			is_accepted: s,
		})
	}
	performUpload(r) {
		return this._apiServer.resolveNextEdits(r)
	}
}