
var q1 = class e extends Zn {
	constructor(r) {
		super("ClientMetricsReporter", e.defaultMaxRecords, e.defaultUploadMsec, e.defaultBatchSize)
		this._apiServer = r
	}
	static defaultMaxRecords = 1e4
	static defaultBatchSize = 500
	static defaultUploadMsec = 1e4
	reportWebviewClientMetric = (r) => {
		this.report({
			client_metric: `webview__${r.webviewName}__${r.client_metric}`,
			value: r.value,
		})
	}
	performUpload(r) {
		return this._apiServer.clientMetrics(r)
	}
}