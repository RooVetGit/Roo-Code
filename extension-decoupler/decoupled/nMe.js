
function Nme(e) {
	return e == null ? (e === void 0 ? "[object Undefined]" : "[object Null]") : Object.prototype.toString.call(e)
}