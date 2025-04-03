
var $F = class e extends cf {
		constructor(r, n, i) {
			super(n, e.title)
			this._syncingEnabledTracker = r
			this._extension = i
		}
		static title = "$(sync) Enable workspace syncing"
		static commandID = "vscode-augment.enable-workspace-syncing"
		run() {
			this._syncingEnabledTracker.syncingEnabledState !== "initializing" &&
				this._syncingEnabledTracker.enableSyncing()
		}
		canRun() {
			let r = this._syncingEnabledTracker.syncingEnabledState
			return super.canRun() && this._extension.ready && (r === "disabled" || r === "partial")
		}
	},
	YF = class e extends cf {
		constructor(r, n, i) {
			super(n, e.title)
			this._syncingStateTracker = r
			this._extension = i
		}
		static title = "$(circle-slash) Disable workspace syncing"
		static commandID = "vscode-augment.disable-workspace-syncing"
		run() {
			this._syncingStateTracker.syncingEnabledState !== "initializing" &&
				this._syncingStateTracker.disableSyncing()
		}
		canRun() {
			let r = this._syncingStateTracker.syncingEnabledState
			return super.canRun() && this._extension.ready && (r === "enabled" || r === "partial")
		}
	}