
var _ut = "Incorrect 'index' type",
	wut = (e) => `Invalid value for key ${e}`,
	Iut = (e) => `Pattern length exceeds max of ${e}.`,
	Sut = (e) => `Missing ${e} property in key`,
	But = (e) => `Property 'weight' in key '${e}' must be a positive integer`,
	Dme = Object.prototype.hasOwnProperty,
	xW = class {
		constructor(t) {
			;(this._keys = []), (this._keyMap = {})
			let r = 0
			t.forEach((n) => {
				let i = Pme(n)
				this._keys.push(i), (this._keyMap[i.id] = i), (r += i.weight)
			}),
				this._keys.forEach((n) => {
					n.weight /= r
				})
		}
		get(t) {
			return this._keyMap[t]
		}
		keys() {
			return this._keys
		}
		toJSON() {
			return JSON.stringify(this._keys)
		}
	}