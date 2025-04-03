
var q1e = kP,
	V1e = new Fs("tag:yaml.org,2002:str", {
		kind: "scalar",
		construct: function (e) {
			return e !== null ? e : ""
		},
	}),
	H1e = new Fs("tag:yaml.org,2002:seq", {
		kind: "sequence",
		construct: function (e) {
			return e !== null ? e : []
		},
	}),
	W1e = new Fs("tag:yaml.org,2002:map", {
		kind: "mapping",
		construct: function (e) {
			return e !== null ? e : {}
		},
	}),
	G1e = new q1e({ explicit: [V1e, H1e, W1e] })