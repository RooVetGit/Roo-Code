
	var xE = require("assert"),
		{ kDestroyed: gee, kBodyUsed: Gm, kListeners: dO, kBody: hee } = Qn(),
		{ IncomingMessage: A3e } = require("http"),
		fB = require("stream"),
		m3e = require("net"),
		{ Blob: y3e } = require("buffer"),
		C3e = require("util"),
		{ stringify: v3e } = require("querystring"),
		{ EventEmitter: E3e } = require("events"),
		{ InvalidArgumentError: Ji } = Vr(),
		{ headerNameLowerCasedRecord: b3e } = lB(),
		{ tree: pee } = fee(),
		[x3e, _3e] = process.versions.node.split(".").map((e) => Number(e)),
		dB = class {
			constructor(t) {
				;(this[hee] = t), (this[Gm] = !1)
			}
			async *[Symbol.asyncIterator]() {
				xE(!this[Gm], "disturbed"), (this[Gm] = !0), yield* this[hee]
			}
		}