
var X1e = new Fs("tag:yaml.org,2002:bool", {
	kind: "scalar",
	resolve: z1e,
	construct: j1e,
	predicate: Z1e,
	represent: {
		lowercase: function (e) {
			return e ? "true" : "false"
		},
		uppercase: function (e) {
			return e ? "TRUE" : "FALSE"
		},
		camelcase: function (e) {
			return e ? "True" : "False"
		},
	},
	defaultStyle: "lowercase",
})