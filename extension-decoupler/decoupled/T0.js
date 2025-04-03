
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