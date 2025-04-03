
var UQe = new Fs("tag:yaml.org,2002:set", {
		kind: "mapping",
		resolve: PQe,
		construct: LQe,
	}),
	aK = pQe.extend({ implicit: [CQe, EQe], explicit: [IQe, RQe, QQe, UQe] }),
	Nf = Object.prototype.hasOwnProperty,
	JI = 1,
	lK = 2,
	cK = 3,
	zI = 4,
	RP = 1,
	OQe = 2,
	HY = 3,
	qQe =
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/,
	VQe = /[\x85\u2028\u2029]/,
	HQe = /[,\[\]\{\}]/,
	uK = /^(?:!|!!|![a-z\-]+!)$/i,
	dK = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i