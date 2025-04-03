
var FFe = R.object({
		jsonrpc: R.literal(RI),
		id: kI,
		error: R.object({
			code: R.number().int(),
			message: R.string(),
			data: R.optional(R.unknown()),
		}),
	}).strict(),
	DY = R.union([RFe, kFe, MFe, FFe]),
	Vg = Zl.strict(),
	MI = Jc.extend({
		method: R.literal("notifications/cancelled"),
		params: Pv.extend({ requestId: kI, reason: R.string().optional() }),
	}),
	TY = R.object({ name: R.string(), version: R.string() }).passthrough(),
	QFe = R.object({
		experimental: R.optional(R.object({}).passthrough()),
		sampling: R.optional(R.object({}).passthrough()),
		roots: R.optional(R.object({ listChanged: R.optional(R.boolean()) }).passthrough()),
	}).passthrough(),
	NFe = fa.extend({
		method: R.literal("initialize"),
		params: jl.extend({
			protocolVersion: R.string(),
			capabilities: QFe,
			clientInfo: TY,
		}),
	}),
	PFe = R.object({
		experimental: R.optional(R.object({}).passthrough()),
		logging: R.optional(R.object({}).passthrough()),
		prompts: R.optional(R.object({ listChanged: R.optional(R.boolean()) }).passthrough()),
		resources: R.optional(
			R.object({
				subscribe: R.optional(R.boolean()),
				listChanged: R.optional(R.boolean()),
			}).passthrough(),
		),
		tools: R.optional(R.object({ listChanged: R.optional(R.boolean()) }).passthrough()),
	}).passthrough(),
	CP = Zl.extend({
		protocolVersion: R.string(),
		capabilities: PFe,
		serverInfo: TY,
	}),
	LFe = Jc.extend({ method: R.literal("notifications/initialized") }),
	FI = fa.extend({ method: R.literal("ping") }),
	UFe = R.object({
		progress: R.number(),
		total: R.optional(R.number()),
	}).passthrough(),
	QI = Jc.extend({
		method: R.literal("notifications/progress"),
		params: Pv.merge(UFe).extend({ progressToken: SY }),
	}),
	NI = fa.extend({ params: jl.extend({ cursor: R.optional(BY) }).optional() }),
	PI = Zl.extend({ nextCursor: R.optional(BY) }),
	RY = R.object({
		uri: R.string(),
		mimeType: R.optional(R.string()),
	}).passthrough(),
	kY = RY.extend({ text: R.string() }),
	MY = RY.extend({ blob: R.string().base64() }),
	OFe = R.object({
		uri: R.string(),
		name: R.string(),
		description: R.optional(R.string()),
		mimeType: R.optional(R.string()),
	}).passthrough(),
	qFe = R.object({
		uriTemplate: R.string(),
		name: R.string(),
		description: R.optional(R.string()),
		mimeType: R.optional(R.string()),
	}).passthrough(),
	VFe = NI.extend({ method: R.literal("resources/list") }),
	vP = PI.extend({ resources: R.array(OFe) }),
	HFe = NI.extend({ method: R.literal("resources/templates/list") }),
	EP = PI.extend({ resourceTemplates: R.array(qFe) }),
	WFe = fa.extend({
		method: R.literal("resources/read"),
		params: jl.extend({ uri: R.string() }),
	}),
	bP = Zl.extend({ contents: R.array(R.union([kY, MY])) }),
	GFe = Jc.extend({
		method: R.literal("notifications/resources/list_changed"),
	}),
	$Fe = fa.extend({
		method: R.literal("resources/subscribe"),
		params: jl.extend({ uri: R.string() }),
	}),
	YFe = fa.extend({
		method: R.literal("resources/unsubscribe"),
		params: jl.extend({ uri: R.string() }),
	}),
	KFe = Jc.extend({
		method: R.literal("notifications/resources/updated"),
		params: Pv.extend({ uri: R.string() }),
	}),
	JFe = R.object({
		name: R.string(),
		description: R.optional(R.string()),
		required: R.optional(R.boolean()),
	}).passthrough(),
	zFe = R.object({
		name: R.string(),
		description: R.optional(R.string()),
		arguments: R.optional(R.array(JFe)),
	}).passthrough(),
	jFe = NI.extend({ method: R.literal("prompts/list") }),
	xP = PI.extend({ prompts: R.array(zFe) }),
	ZFe = fa.extend({
		method: R.literal("prompts/get"),
		params: jl.extend({
			name: R.string(),
			arguments: R.optional(R.record(R.string())),
		}),
	}),
	LI = R.object({ type: R.literal("text"), text: R.string() }).passthrough(),
	UI = R.object({
		type: R.literal("image"),
		data: R.string().base64(),
		mimeType: R.string(),
	}).passthrough(),
	FY = R.object({
		type: R.literal("resource"),
		resource: R.union([kY, MY]),
	}).passthrough(),
	XFe = R.object({
		role: R.enum(["user", "assistant"]),
		content: R.union([LI, UI, FY]),
	}).passthrough(),
	_P = Zl.extend({
		description: R.optional(R.string()),
		messages: R.array(XFe),
	}),
	e1e = Jc.extend({ method: R.literal("notifications/prompts/list_changed") }),
	t1e = R.object({
		name: R.string(),
		description: R.optional(R.string()),
		inputSchema: R.object({
			type: R.literal("object"),
			properties: R.optional(R.object({}).passthrough()),
		}).passthrough(),
	}).passthrough(),
	r1e = NI.extend({ method: R.literal("tools/list") }),
	wP = PI.extend({ tools: R.array(t1e) }),
	cm = Zl.extend({
		content: R.array(R.union([LI, UI, FY])),
		isError: R.boolean().default(!1).optional(),
	}),
	dEt = cm.or(Zl.extend({ toolResult: R.unknown() })),
	n1e = fa.extend({
		method: R.literal("tools/call"),
		params: jl.extend({
			name: R.string(),
			arguments: R.optional(R.record(R.unknown())),
		}),
	}),
	i1e = Jc.extend({ method: R.literal("notifications/tools/list_changed") }),
	QY = R.enum(["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"]),
	s1e = fa.extend({
		method: R.literal("logging/setLevel"),
		params: jl.extend({ level: QY }),
	}),
	o1e = Jc.extend({
		method: R.literal("notifications/message"),
		params: Pv.extend({
			level: QY,
			logger: R.optional(R.string()),
			data: R.unknown(),
		}),
	}),
	a1e = R.object({ name: R.string().optional() }).passthrough(),
	l1e = R.object({
		hints: R.optional(R.array(a1e)),
		costPriority: R.optional(R.number().min(0).max(1)),
		speedPriority: R.optional(R.number().min(0).max(1)),
		intelligencePriority: R.optional(R.number().min(0).max(1)),
	}).passthrough(),
	c1e = R.object({
		role: R.enum(["user", "assistant"]),
		content: R.union([LI, UI]),
	}).passthrough(),
	u1e = fa.extend({
		method: R.literal("sampling/createMessage"),
		params: jl.extend({
			messages: R.array(c1e),
			systemPrompt: R.optional(R.string()),
			includeContext: R.optional(R.enum(["none", "thisServer", "allServers"])),
			temperature: R.optional(R.number()),
			maxTokens: R.number().int(),
			stopSequences: R.optional(R.array(R.string())),
			metadata: R.optional(R.object({}).passthrough()),
			modelPreferences: R.optional(l1e),
		}),
	}),
	d1e = Zl.extend({
		model: R.string(),
		stopReason: R.optional(R.enum(["endTurn", "stopSequence", "maxTokens"]).or(R.string())),
		role: R.enum(["user", "assistant"]),
		content: R.discriminatedUnion("type", [LI, UI]),
	}),
	f1e = R.object({
		type: R.literal("ref/resource"),
		uri: R.string(),
	}).passthrough(),
	h1e = R.object({
		type: R.literal("ref/prompt"),
		name: R.string(),
	}).passthrough(),
	g1e = fa.extend({
		method: R.literal("completion/complete"),
		params: jl.extend({
			ref: R.union([h1e, f1e]),
			argument: R.object({ name: R.string(), value: R.string() }).passthrough(),
		}),
	}),
	IP = Zl.extend({
		completion: R.object({
			values: R.array(R.string()).max(100),
			total: R.optional(R.number().int()),
			hasMore: R.optional(R.boolean()),
		}).passthrough(),
	}),
	p1e = R.object({
		uri: R.string().startsWith("file://"),
		name: R.optional(R.string()),
	}).passthrough(),
	A1e = fa.extend({ method: R.literal("roots/list") }),
	m1e = Zl.extend({ roots: R.array(p1e) }),
	y1e = Jc.extend({ method: R.literal("notifications/roots/list_changed") }),
	fEt = R.union([FI, NFe, g1e, s1e, ZFe, jFe, VFe, HFe, WFe, $Fe, YFe, n1e, r1e]),
	hEt = R.union([MI, QI, LFe, y1e]),
	gEt = R.union([Vg, d1e, m1e]),
	pEt = R.union([FI, u1e, A1e]),
	AEt = R.union([MI, QI, o1e, KFe, GFe, i1e, e1e]),
	mEt = R.union([Vg, CP, IP, _P, xP, vP, EP, bP, cm, wP]),
	lm = class extends Error {
		code
		data
		constructor(t, r, n) {
			super(`MCP error ${t}: ${r}`), (this.code = t), (this.data = n)
		}
	}