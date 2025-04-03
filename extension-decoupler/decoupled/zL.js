
var yP = "2024-11-05",
	IY = [yP, "2024-10-07"],
	RI = "2.0",
	SY = R.union([R.string(), R.number().int()]),
	BY = R.string(),
	jl = R.object({
		_meta: R.optional(R.object({ progressToken: R.optional(SY) }).passthrough()),
	}).passthrough(),
	fa = R.object({ method: R.string(), params: R.optional(jl) }),
	Pv = R.object({
		_meta: R.optional(R.object({}).passthrough()),
	}).passthrough(),
	Jc = R.object({ method: R.string(), params: R.optional(Pv) }),
	Zl = R.object({
		_meta: R.optional(R.object({}).passthrough()),
	}).passthrough(),
	kI = R.union([R.string(), R.number().int()]),
	RFe = R.object({ jsonrpc: R.literal(RI), id: kI })
		.merge(fa)
		.strict(),
	kFe = R.object({ jsonrpc: R.literal(RI) })
		.merge(Jc)
		.strict(),
	MFe = R.object({ jsonrpc: R.literal(RI), id: kI, result: Zl }).strict(),
	qg
;