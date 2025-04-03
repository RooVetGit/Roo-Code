
var c8 = class {
		constructor(t, r) {
			this.suggestion = t
			this.isNext = r
		}
		toString() {
			return "hinted-suggestion"
		}
	},
	Kn = class {
		constructor() {}
		get suggestion() {}
		toString() {
			return "no-suggestions"
		}
	},
	ls = class {
		constructor(t, r) {
			this.suggestion = t
			this.isNext = r
		}
		toString() {
			return "hinting"
		}
		get hintedSuggestion() {
			return new c8(this.suggestion, this.isNext)
		}
	},
	_r = class {
		constructor(t) {
			this.suggestion = t
		}
		toString() {
			return "before-preview"
		}
	},
	Ut = class {
		constructor(t) {
			this.suggestion = t
		}
		toString() {
			return "after-preview"
		}
	},
	wr = class {
		constructor(t, r, n) {
			this.suggestion = t
			this.selection = r
			this.timeout = n
		}
		toString() {
			return "animating"
		}
	}