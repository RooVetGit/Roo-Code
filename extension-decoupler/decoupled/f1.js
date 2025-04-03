
var e_e = new Map([
		["authenticated", { name: "authenticated", status: "initializing" }],
		["syncingPermitted", { name: "syncingPermitted", status: "complete" }],
		["disabledGithubCopilot", { name: "disabledGithubCopilot", status: "initializing" }],
		["hasMovedExtensionAside", { name: "hasMovedExtensionAside", status: "incomplete" }],
		["workspacePopulated", { name: "workspacePopulated", status: "initializing" }],
		["workspaceSelected", { name: "workspaceSelected", status: "initializing" }],
		["disabledCodeium", { name: "disabledCodeium", status: "initializing" }],
		["uploadingHomeDir", { name: "uploadingHomeDir", status: "initializing" }],
		["workspaceTooLarge", { name: "workspaceTooLarge", status: "initializing" }],
	]),
	t_e = new Map([
		[
			"UserShouldSignIn",
			{
				name: "UserShouldSignIn",
				renderOrder: 0,
				desiredConditions: [{ name: "authenticated", status: "incomplete" }],
			},
		],
		[
			"SyncingPermissionNeeded",
			{
				name: "SyncingPermissionNeeded",
				renderOrder: 1,
				desiredConditions: [{ name: "syncingPermitted", status: "initializing" }],
			},
		],
		[
			"uploadingHomeDir",
			{
				name: "uploadingHomeDir",
				renderOrder: 2,
				desiredConditions: [{ name: "uploadingHomeDir", status: "complete" }],
			},
		],
		[
			"workspaceTooLarge",
			{
				name: "workspaceTooLarge",
				renderOrder: 2,
				desiredConditions: [{ name: "workspaceTooLarge", status: "complete" }],
			},
		],
		[
			"ShouldDisableCopilot",
			{
				name: "ShouldDisableCopilot",
				renderOrder: 3,
				desiredConditions: [
					{ name: "authenticated", status: "complete" },
					{ name: "disabledGithubCopilot", status: "incomplete" },
				],
			},
		],
		[
			"ShouldDisableCodeium",
			{
				name: "ShouldDisableCodeium",
				renderOrder: 3,
				desiredConditions: [
					{ name: "authenticated", status: "complete" },
					{ name: "disabledCodeium", status: "incomplete" },
				],
			},
		],
		[
			"WorkspaceNotSelected",
			{
				name: "WorkspaceNotSelected",
				renderOrder: 5,
				desiredConditions: [
					{ name: "authenticated", status: "complete" },
					{ name: "syncingPermitted", status: "complete" },
					{ name: "workspaceSelected", status: "incomplete" },
				],
			},
		],
		[
			"WorkspacePopulated",
			{
				name: "WorkspacePopulated",
				renderOrder: 5,
				desiredConditions: [
					{ name: "authenticated", status: "complete" },
					{ name: "syncingPermitted", status: "complete" },
					{ name: "workspaceSelected", status: "complete" },
					{ name: "workspacePopulated", status: "complete" },
				],
			},
		],
		[
			"WorkspaceNotPopulated",
			{
				name: "WorkspaceNotPopulated",
				renderOrder: 5,
				desiredConditions: [
					{ name: "authenticated", status: "complete" },
					{ name: "syncingPermitted", status: "complete" },
					{ name: "workspaceSelected", status: "complete" },
					{ name: "workspacePopulated", status: "incomplete" },
				],
			},
		],
		[
			"AllActionsComplete",
			{
				name: "AllActionsComplete",
				renderOrder: 6,
				desiredConditions: [
					{ name: "authenticated", status: "complete" },
					{ name: "syncingPermitted", status: "complete" },
					{ name: "disabledGithubCopilot", status: "complete" },
					{ name: "disabledCodeium", status: "complete" },
					{ name: "workspacePopulated", status: "complete" },
					{ name: "workspaceSelected", status: "complete" },
				],
			},
		],
	]),
	F1 = class extends z {
		_systemStates
		_derivedStates
		_onDerivedStatesSatisfied = new r_e.EventEmitter()
		_systemToDerivedStateMap = new Map()
		_globalState
		_satisfiedDerivedStates = new Set()
		constructor(t, r = e_e, n = t_e) {
			super(),
				this.addDisposable(this._onDerivedStatesSatisfied),
				(this._systemStates = new Map(r)),
				(this._derivedStates = new Map(n)),
				(this._globalState = t),
				this.loadSystemStates(),
				this._derivedStates.forEach(this.updateSystemToDerivedStateMap.bind(this)),
				this._derivedStates.forEach((i) => {
					this._isStateSatisfied(i) && this._satisfiedDerivedStates.add(i.name)
				}),
				this._emitSatisfiedStates()
		}
		get satisfiedStates() {
			return Array.from(this._satisfiedDerivedStates)
				.map((t) => this._derivedStates.get(t))
				.sort((t, r) => t.renderOrder - r.renderOrder)
		}
		saveSystemStates() {
			let t = JSON.stringify(Array.from(this._systemStates.entries()))
			this._globalState.update("actionSystemStates", t)
		}
		loadSystemStates() {
			let t = this._globalState.get("actionSystemStates") || "[]"
			new Map(JSON.parse(t)).forEach((n) => {
				this._systemStates.set(n.name, n)
			})
		}
		get onDerivedStatesSatisfied() {
			return this._onDerivedStatesSatisfied.event
		}
		updateSystemToDerivedStateMap(t) {
			t.desiredConditions.forEach((r) => {
				this._systemToDerivedStateMap.has(r.name) || this._systemToDerivedStateMap.set(r.name, new Set()),
					this._systemToDerivedStateMap.get(r.name).add(t.name)
			})
		}
		setSystemStateStatus(t, r) {
			let n = { name: t, status: r }
			this._systemStates.set(n.name, n), this.saveSystemStates()
			let i = this._systemToDerivedStateMap.get(n.name) || new Set(),
				s = !1
			i.forEach((o) => {
				let a = this._derivedStates.get(o)
				if (a) {
					let l = this._satisfiedDerivedStates.has(o),
						c = this._isStateSatisfied(a)
					l !== c &&
						((s = !0), c ? this._satisfiedDerivedStates.add(o) : this._satisfiedDerivedStates.delete(o))
				}
			}),
				s && this._emitSatisfiedStates(),
				this.saveSystemStates()
		}
		restartActionsState() {
			;(this._systemStates = new Map(e_e)),
				(this._derivedStates = new Map(t_e)),
				(this._systemToDerivedStateMap = new Map()),
				(this._satisfiedDerivedStates = new Set()),
				this._derivedStates.forEach(this.updateSystemToDerivedStateMap.bind(this)),
				this._derivedStates.forEach((t) => {
					this._isStateSatisfied(t) && this._satisfiedDerivedStates.add(t.name)
				}),
				this._emitSatisfiedStates(),
				this.saveSystemStates()
		}
		getSystemState(t) {
			return this._systemStates.get(t)
		}
		addDerivedState(t) {
			this._derivedStates.set(t.name, t),
				this.updateSystemToDerivedStateMap(t),
				this._isStateSatisfied(t) && (this._satisfiedDerivedStates.add(t.name), this._emitSatisfiedStates()),
				this.saveSystemStates()
		}
		isDerivedStateSatisfied(t) {
			let r = this._derivedStates.get(t)
			return r ? this._isStateSatisfied(r) : !1
		}
		isSystemStateComplete(t) {
			return this._systemStates.get(t)?.status === "complete"
		}
		_emitSatisfiedStates() {
			this._onDerivedStatesSatisfied.fire(this.satisfiedStates)
		}
		broadcastDerivedStates() {
			this._emitSatisfiedStates()
		}
		_isStateSatisfied(t) {
			for (let r of t.desiredConditions) {
				let n = this._systemStates.get(r.name)
				if (!n || n.status !== r.status) return !1
			}
			return !0
		}
	}