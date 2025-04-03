
var W1 = class e extends Zn {
	constructor(r, n, i, s) {
		super("TimelineEventReporter", n ?? e.defaultMaxRecords, i ?? e.defaultUploadMsec, s ?? e.defaultBatchSize)
		this._apiServer = r
	}
	static defaultMaxRecords = 1e4
	static defaultBatchSize = 1e3
	static defaultUploadMsec = 1e4
	reportCompletionTimeline(r, n) {
		if (!n.emitTime || !n.rpcStart || !n.rpcEnd) return
		let [i, s] = kn(n.requestStart),
			[o, a] = kn(n.emitTime),
			[l, c] = kn(n.rpcStart),
			[u, f] = kn(n.rpcEnd)
		this.report({
			request_id: r,
			initial_request_time_sec: i,
			initial_request_time_nsec: s,
			api_start_time_sec: l,
			api_start_time_nsec: c,
			api_end_time_sec: u,
			api_end_time_nsec: f,
			emit_time_sec: o,
			emit_time_nsec: a,
		})
	}
	performUpload(r) {
		return this._apiServer.reportClientCompletionTimelines(r)
	}
}