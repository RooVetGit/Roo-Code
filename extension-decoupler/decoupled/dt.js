
var Tut = { includeMatches: !1, findAllMatches: !1, minMatchCharLength: 1 },
	Rut = {
		isCaseSensitive: !1,
		includeScore: !1,
		keys: [],
		shouldSort: !0,
		sortFn: (e, t) => (e.score === t.score ? (e.idx < t.idx ? -1 : 1) : e.score < t.score ? -1 : 1),
	},
	kut = { location: 0, threshold: 0.6, distance: 100 },
	Mut = {
		useExtendedSearch: !1,
		getFn: Dut,
		ignoreLocation: !1,
		ignoreFieldNorm: !1,
		fieldNormWeight: 1,
	},
	Dt = { ...Rut, ...Tut, ...kut, ...Mut },
	Fut = /[^ ]+/g