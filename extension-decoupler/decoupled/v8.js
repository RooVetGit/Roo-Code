
var V8 = class {
	constructor(t) {
		this._pathFilter = t
	}
	isUploadable(t) {
		return this._pathFilter.acceptsPath(t)
	}
}