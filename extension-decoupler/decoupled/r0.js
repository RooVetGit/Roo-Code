
var R0 = x((vSt, Loe) => {
	"use strict"
	var { webidl: et } = ys(),
		{ kEnumerableProperty: Oo } = Xt(),
		{ kConstruct: Poe } = Qn(),
		{ MessagePort: lJe } = require("worker_threads"),
		T0 = class e extends Event {
			#e
			constructor(t, r = {}) {
				if (t === Poe) {
					super(arguments[1], arguments[2]), et.util.markAsUncloneable(this)
					return
				}
				let n = "MessageEvent constructor"
				et.argumentLengthCheck(arguments, 1, n),
					(t = et.converters.DOMString(t, n, "type")),
					(r = et.converters.MessageEventInit(r, n, "eventInitDict")),
					super(t, r),
					(this.#e = r),
					et.util.markAsUncloneable(this)
			}
			get data() {
				return et.brandCheck(this, e), this.#e.data
			}
			get origin() {
				return et.brandCheck(this, e), this.#e.origin
			}
			get lastEventId() {
				return et.brandCheck(this, e), this.#e.lastEventId
			}
			get source() {
				return et.brandCheck(this, e), this.#e.source
			}
			get ports() {
				return (
					et.brandCheck(this, e),
					Object.isFrozen(this.#e.ports) || Object.freeze(this.#e.ports),
					this.#e.ports
				)
			}
			initMessageEvent(t, r = !1, n = !1, i = null, s = "", o = "", a = null, l = []) {
				return (
					et.brandCheck(this, e),
					et.argumentLengthCheck(arguments, 1, "MessageEvent.initMessageEvent"),
					new e(t, {
						bubbles: r,
						cancelable: n,
						data: i,
						origin: s,
						lastEventId: o,
						source: a,
						ports: l,
					})
				)
			}
			static createFastMessageEvent(t, r) {
				let n = new e(Poe, t, r)
				return (
					(n.#e = r),
					(n.#e.data ??= null),
					(n.#e.origin ??= ""),
					(n.#e.lastEventId ??= ""),
					(n.#e.source ??= null),
					(n.#e.ports ??= []),
					n
				)
			}
		},
		{ createFastMessageEvent: cJe } = T0
	delete T0.createFastMessageEvent
	var qD = class e extends Event {
			#e
			constructor(t, r = {}) {
				let n = "CloseEvent constructor"
				et.argumentLengthCheck(arguments, 1, n),
					(t = et.converters.DOMString(t, n, "type")),
					(r = et.converters.CloseEventInit(r)),
					super(t, r),
					(this.#e = r),
					et.util.markAsUncloneable(this)
			}
			get wasClean() {
				return et.brandCheck(this, e), this.#e.wasClean
			}
			get code() {
				return et.brandCheck(this, e), this.#e.code
			}
			get reason() {
				return et.brandCheck(this, e), this.#e.reason
			}
		},
		VD = class e extends Event {
			#e
			constructor(t, r) {
				let n = "ErrorEvent constructor"
				et.argumentLengthCheck(arguments, 1, n),
					super(t, r),
					et.util.markAsUncloneable(this),
					(t = et.converters.DOMString(t, n, "type")),
					(r = et.converters.ErrorEventInit(r ?? {})),
					(this.#e = r)
			}
			get message() {
				return et.brandCheck(this, e), this.#e.message
			}
			get filename() {
				return et.brandCheck(this, e), this.#e.filename
			}
			get lineno() {
				return et.brandCheck(this, e), this.#e.lineno
			}
			get colno() {
				return et.brandCheck(this, e), this.#e.colno
			}
			get error() {
				return et.brandCheck(this, e), this.#e.error
			}
		}
	Object.defineProperties(T0.prototype, {
		[Symbol.toStringTag]: { value: "MessageEvent", configurable: !0 },
		data: Oo,
		origin: Oo,
		lastEventId: Oo,
		source: Oo,
		ports: Oo,
		initMessageEvent: Oo,
	})
	Object.defineProperties(qD.prototype, {
		[Symbol.toStringTag]: { value: "CloseEvent", configurable: !0 },
		reason: Oo,
		code: Oo,
		wasClean: Oo,
	})
	Object.defineProperties(VD.prototype, {
		[Symbol.toStringTag]: { value: "ErrorEvent", configurable: !0 },
		message: Oo,
		filename: Oo,
		lineno: Oo,
		colno: Oo,
		error: Oo,
	})
	et.converters.MessagePort = et.interfaceConverter(lJe)
	et.converters["sequence<MessagePort>"] = et.sequenceConverter(et.converters.MessagePort)
	var $V = [
		{
			key: "bubbles",
			converter: et.converters.boolean,
			defaultValue: () => !1,
		},
		{
			key: "cancelable",
			converter: et.converters.boolean,
			defaultValue: () => !1,
		},
		{
			key: "composed",
			converter: et.converters.boolean,
			defaultValue: () => !1,
		},
	]
	et.converters.MessageEventInit = et.dictionaryConverter([
		...$V,
		{ key: "data", converter: et.converters.any, defaultValue: () => null },
		{
			key: "origin",
			converter: et.converters.USVString,
			defaultValue: () => "",
		},
		{
			key: "lastEventId",
			converter: et.converters.DOMString,
			defaultValue: () => "",
		},
		{
			key: "source",
			converter: et.nullableConverter(et.converters.MessagePort),
			defaultValue: () => null,
		},
		{
			key: "ports",
			converter: et.converters["sequence<MessagePort>"],
			defaultValue: () => new Array(0),
		},
	])
	et.converters.CloseEventInit = et.dictionaryConverter([
		...$V,
		{
			key: "wasClean",
			converter: et.converters.boolean,
			defaultValue: () => !1,
		},
		{
			key: "code",
			converter: et.converters["unsigned short"],
			defaultValue: () => 0,
		},
		{
			key: "reason",
			converter: et.converters.USVString,
			defaultValue: () => "",
		},
	])
	et.converters.ErrorEventInit = et.dictionaryConverter([
		...$V,
		{
			key: "message",
			converter: et.converters.DOMString,
			defaultValue: () => "",
		},
		{
			key: "filename",
			converter: et.converters.USVString,
			defaultValue: () => "",
		},
		{
			key: "lineno",
			converter: et.converters["unsigned long"],
			defaultValue: () => 0,
		},
		{
			key: "colno",
			converter: et.converters["unsigned long"],
			defaultValue: () => 0,
		},
		{ key: "error", converter: et.converters.any },
	])
	Loe.exports = {
		MessageEvent: T0,
		CloseEvent: qD,
		ErrorEvent: VD,
		createFastMessageEvent: cJe,
	}
})