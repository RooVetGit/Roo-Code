
var pA = class e extends lt {
		constructor(r) {
			super("Start Extension CPU Profile")
			this._flagManager = r
		}
		static commandID = "vscode-augment.cpu-profile.start"
		static isProfileRunning = !1
		type = "debug"
		run() {
			!this._flagManager.currentFlags.vscodeEnableCpuProfile ||
				e.isProfileRunning ||
				(e.markAsRunning(), console.profile())
		}
		canRun() {
			return this._flagManager.currentFlags.vscodeEnableCpuProfile && !e.isProfileRunning
		}
		static markAsRunning() {
			e.isProfileRunning = !0
		}
		static markAsNotRunning() {
			e.isProfileRunning = !1
		}
	},
	GF = class extends lt {
		constructor(r) {
			super("End Extension CPU Profile")
			this._flagManager = r
		}
		static commandID = "vscode-augment.cpu-profile.stop"
		type = "debug"
		run() {
			pA.isProfileRunning && (console.profileEnd(), pA.markAsNotRunning())
		}
		canRun() {
			return pA.isProfileRunning
		}
	}