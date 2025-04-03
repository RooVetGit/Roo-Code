
var poe = x((dSt, goe) => {
	"use strict"
	var { staticPropertyDescriptors: S0, readOperation: RD, fireAProgressEvent: foe } = doe(),
		{ kState: Cp, kError: hoe, kResult: kD, kEvents: Hr, kAborted: kKe } = UV(),
		{ webidl: on } = ys(),
		{ kEnumerableProperty: Uo } = Xt(),
		dc = class e extends EventTarget {
			constructor() {
				super(),
					(this[Cp] = "empty"),
					(this[kD] = null),
					(this[hoe] = null),
					(this[Hr] = {
						loadend: null,
						error: null,
						abort: null,
						load: null,
						progress: null,
						loadstart: null,
					})
			}
			readAsArrayBuffer(t) {
				on.brandCheck(this, e),
					on.argumentLengthCheck(arguments, 1, "FileReader.readAsArrayBuffer"),
					(t = on.converters.Blob(t, { strict: !1 })),
					RD(this, t, "ArrayBuffer")
			}
			readAsBinaryString(t) {
				on.brandCheck(this, e),
					on.argumentLengthCheck(arguments, 1, "FileReader.readAsBinaryString"),
					(t = on.converters.Blob(t, { strict: !1 })),
					RD(this, t, "BinaryString")
			}
			readAsText(t, r = void 0) {
				on.brandCheck(this, e),
					on.argumentLengthCheck(arguments, 1, "FileReader.readAsText"),
					(t = on.converters.Blob(t, { strict: !1 })),
					r !== void 0 && (r = on.converters.DOMString(r, "FileReader.readAsText", "encoding")),
					RD(this, t, "Text", r)
			}
			readAsDataURL(t) {
				on.brandCheck(this, e),
					on.argumentLengthCheck(arguments, 1, "FileReader.readAsDataURL"),
					(t = on.converters.Blob(t, { strict: !1 })),
					RD(this, t, "DataURL")
			}
			abort() {
				if (this[Cp] === "empty" || this[Cp] === "done") {
					this[kD] = null
					return
				}
				this[Cp] === "loading" && ((this[Cp] = "done"), (this[kD] = null)),
					(this[kKe] = !0),
					foe("abort", this),
					this[Cp] !== "loading" && foe("loadend", this)
			}
			get readyState() {
				switch ((on.brandCheck(this, e), this[Cp])) {
					case "empty":
						return this.EMPTY
					case "loading":
						return this.LOADING
					case "done":
						return this.DONE
				}
			}
			get result() {
				return on.brandCheck(this, e), this[kD]
			}
			get error() {
				return on.brandCheck(this, e), this[hoe]
			}
			get onloadend() {
				return on.brandCheck(this, e), this[Hr].loadend
			}
			set onloadend(t) {
				on.brandCheck(this, e),
					this[Hr].loadend && this.removeEventListener("loadend", this[Hr].loadend),
					typeof t == "function"
						? ((this[Hr].loadend = t), this.addEventListener("loadend", t))
						: (this[Hr].loadend = null)
			}
			get onerror() {
				return on.brandCheck(this, e), this[Hr].error
			}
			set onerror(t) {
				on.brandCheck(this, e),
					this[Hr].error && this.removeEventListener("error", this[Hr].error),
					typeof t == "function"
						? ((this[Hr].error = t), this.addEventListener("error", t))
						: (this[Hr].error = null)
			}
			get onloadstart() {
				return on.brandCheck(this, e), this[Hr].loadstart
			}
			set onloadstart(t) {
				on.brandCheck(this, e),
					this[Hr].loadstart && this.removeEventListener("loadstart", this[Hr].loadstart),
					typeof t == "function"
						? ((this[Hr].loadstart = t), this.addEventListener("loadstart", t))
						: (this[Hr].loadstart = null)
			}
			get onprogress() {
				return on.brandCheck(this, e), this[Hr].progress
			}
			set onprogress(t) {
				on.brandCheck(this, e),
					this[Hr].progress && this.removeEventListener("progress", this[Hr].progress),
					typeof t == "function"
						? ((this[Hr].progress = t), this.addEventListener("progress", t))
						: (this[Hr].progress = null)
			}
			get onload() {
				return on.brandCheck(this, e), this[Hr].load
			}
			set onload(t) {
				on.brandCheck(this, e),
					this[Hr].load && this.removeEventListener("load", this[Hr].load),
					typeof t == "function"
						? ((this[Hr].load = t), this.addEventListener("load", t))
						: (this[Hr].load = null)
			}
			get onabort() {
				return on.brandCheck(this, e), this[Hr].abort
			}
			set onabort(t) {
				on.brandCheck(this, e),
					this[Hr].abort && this.removeEventListener("abort", this[Hr].abort),
					typeof t == "function"
						? ((this[Hr].abort = t), this.addEventListener("abort", t))
						: (this[Hr].abort = null)
			}
		}
	dc.EMPTY = dc.prototype.EMPTY = 0
	dc.LOADING = dc.prototype.LOADING = 1
	dc.DONE = dc.prototype.DONE = 2
	Object.defineProperties(dc.prototype, {
		EMPTY: S0,
		LOADING: S0,
		DONE: S0,
		readAsArrayBuffer: Uo,
		readAsBinaryString: Uo,
		readAsText: Uo,
		readAsDataURL: Uo,
		abort: Uo,
		readyState: Uo,
		result: Uo,
		error: Uo,
		onloadstart: Uo,
		onprogress: Uo,
		onload: Uo,
		onabort: Uo,
		onerror: Uo,
		onloadend: Uo,
		[Symbol.toStringTag]: {
			value: "FileReader",
			writable: !1,
			enumerable: !1,
			configurable: !0,
		},
	})
	Object.defineProperties(dc, { EMPTY: S0, LOADING: S0, DONE: S0 })
	goe.exports = { FileReader: dc }
})