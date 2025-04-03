
var yA = class {
	constructor(t) {
		this._statusBar = t
	}
	_state
	setState(t) {
		return this.dispose(), (this._state = this._statusBar.setState(t)), this._state
	}
	dispose() {
		this._state?.dispose()
	}
}