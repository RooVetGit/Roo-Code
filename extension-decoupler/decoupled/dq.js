
var wyt = "Augment",
	DQ = class extends z {
		_statusBarItem
		_stateManager = new SQ(Mxe)
		_currentState
		constructor() {
			super(),
				this.addDisposable(new MC.Disposable(() => this.reset())),
				(this._statusBarItem = MC.window.createStatusBarItem(
					"vscode-augment.PrimaryStatusBarItem",
					MC.StatusBarAlignment.Right,
				)),
				(this._statusBarItem.name = "Augment"),
				(this._statusBarItem.command = pC.commandID),
				this.addDisposables(
					this._statusBarItem,
					this._stateManager.onDidChangeState(() => this.updateState()),
				),
				this.updateState(),
				this._statusBarItem.show()
		}
		updateState() {
			let t = this._stateManager.getPriorityState()
			if (t === this._currentState) return
			;(this._currentState = t),
				(this._statusBarItem.tooltip = t.tooltip),
				(this._statusBarItem.backgroundColor = t.colors?.background),
				(this._statusBarItem.color = t.colors?.foreground)
			let r = t.label ? t.label : wyt
			this._statusBarItem.text = `${t.icon} ${r}`
		}
		setState(t) {
			let r = this._stateManager.setState(t)
			return this.updateState(), r
		}
		reset() {
			this._stateManager.reset()
		}
	}