
var O1 = class e extends Zn {
	constructor(r, n, i, s) {
		super("AgentRequestEventReporter", n ?? e.defaultMaxRecords, i ?? e.defaultUploadMsec, s ?? e.defaultBatchSize)
		this._apiServer = r
	}
	static defaultMaxRecords = 1e4
	static defaultBatchSize = 1e3
	static defaultUploadMsec = 1e4
	reportEvent(r) {
		let [n, i] = kn(Date.now())
		this.report({
			event_time_sec: n,
			event_time_nsec: i,
			event_name: r.eventName,
			conversation_id: r.conversationId,
			request_id: r.requestId,
			chat_history_length: r.chatHistoryLength,
		})
	}
	performUpload(r) {
		return this._apiServer.logAgentRequestEvent(r)
	}
}