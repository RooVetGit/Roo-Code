
var wW = class extends ku {
		constructor(t) {
			super(t)
		}
		static get type() {
			return "exact"
		}
		static get multiRegex() {
			return /^="(.*)"$/
		}
		static get singleRegex() {
			return /^=(.*)$/
		}
		search(t) {
			let r = t === this.pattern
			return {
				isMatch: r,
				score: r ? 0 : 1,
				indices: [0, this.pattern.length - 1],
			}
		}
	},
	IW = class extends ku {
		constructor(t) {
			super(t)
		}
		static get type() {
			return "inverse-exact"
		}
		static get multiRegex() {
			return /^!"(.*)"$/
		}
		static get singleRegex() {
			return /^!(.*)$/
		}
		search(t) {
			let n = t.indexOf(this.pattern) === -1
			return { isMatch: n, score: n ? 0 : 1, indices: [0, t.length - 1] }
		}
	},
	SW = class extends ku {
		constructor(t) {
			super(t)
		}
		static get type() {
			return "prefix-exact"
		}
		static get multiRegex() {
			return /^\^"(.*)"$/
		}
		static get singleRegex() {
			return /^\^(.*)$/
		}
		search(t) {
			let r = t.startsWith(this.pattern)
			return {
				isMatch: r,
				score: r ? 0 : 1,
				indices: [0, this.pattern.length - 1],
			}
		}
	},
	BW = class extends ku {
		constructor(t) {
			super(t)
		}
		static get type() {
			return "inverse-prefix-exact"
		}
		static get multiRegex() {
			return /^!\^"(.*)"$/
		}
		static get singleRegex() {
			return /^!\^(.*)$/
		}
		search(t) {
			let r = !t.startsWith(this.pattern)
			return { isMatch: r, score: r ? 0 : 1, indices: [0, t.length - 1] }
		}
	},
	DW = class extends ku {
		constructor(t) {
			super(t)
		}
		static get type() {
			return "suffix-exact"
		}
		static get multiRegex() {
			return /^"(.*)"\$$/
		}
		static get singleRegex() {
			return /^(.*)\$$/
		}
		search(t) {
			let r = t.endsWith(this.pattern)
			return {
				isMatch: r,
				score: r ? 0 : 1,
				indices: [t.length - this.pattern.length, t.length - 1],
			}
		}
	},
	TW = class extends ku {
		constructor(t) {
			super(t)
		}
		static get type() {
			return "inverse-suffix-exact"
		}
		static get multiRegex() {
			return /^!"(.*)"\$$/
		}
		static get singleRegex() {
			return /^!(.*)\$$/
		}
		search(t) {
			let r = !t.endsWith(this.pattern)
			return { isMatch: r, score: r ? 0 : 1, indices: [0, t.length - 1] }
		}
	},
	_k = class extends ku {
		constructor(
			t,
			{
				location: r = Dt.location,
				threshold: n = Dt.threshold,
				distance: i = Dt.distance,
				includeMatches: s = Dt.includeMatches,
				findAllMatches: o = Dt.findAllMatches,
				minMatchCharLength: a = Dt.minMatchCharLength,
				isCaseSensitive: l = Dt.isCaseSensitive,
				ignoreLocation: c = Dt.ignoreLocation,
			} = {},
		) {
			super(t),
				(this._bitapSearch = new xk(t, {
					location: r,
					threshold: n,
					distance: i,
					includeMatches: s,
					findAllMatches: o,
					minMatchCharLength: a,
					isCaseSensitive: l,
					ignoreLocation: c,
				}))
		}
		static get type() {
			return "fuzzy"
		}
		static get multiRegex() {
			return /^"(.*)"$/
		}
		static get singleRegex() {
			return /^(.*)$/
		}
		search(t) {
			return this._bitapSearch.searchIn(t)
		}
	},
	wk = class extends ku {
		constructor(t) {
			super(t)
		}
		static get type() {
			return "include"
		}
		static get multiRegex() {
			return /^'"(.*)"$/
		}
		static get singleRegex() {
			return /^'(.*)$/
		}
		search(t) {
			let r = 0,
				n,
				i = [],
				s = this.pattern.length
			for (; (n = t.indexOf(this.pattern, r)) > -1; ) (r = n + s), i.push([n, r - 1])
			let o = !!i.length
			return { isMatch: o, score: o ? 0 : 1, indices: i }
		}
	},
	RW = [wW, wk, SW, BW, TW, DW, IW, _k],
	kme = RW.length,
	Out = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/,
	qut = "|"