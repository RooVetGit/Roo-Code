
var yue = x((Wo) => {
	"use strict"
	var vh =
			(Wo && Wo.__assign) ||
			function () {
				return (
					(vh =
						Object.assign ||
						function (e) {
							for (var t, r = 1, n = arguments.length; r < n; r++) {
								t = arguments[r]
								for (var i in t) Object.prototype.hasOwnProperty.call(t, i) && (e[i] = t[i])
							}
							return e
						}),
					vh.apply(this, arguments)
				)
			},
		MT =
			(Wo && Wo.__spreadArray) ||
			function (e, t, r) {
				if (r || arguments.length === 2)
					for (var n = 0, i = t.length, s; n < i; n++)
						(s || !(n in t)) && (s || (s = Array.prototype.slice.call(t, 0, n)), (s[n] = t[n]))
				return e.concat(s || Array.prototype.slice.call(t))
			}
	Object.defineProperty(Wo, "__esModule", { value: !0 })
	Wo.convert = Wo.Format = Wo.addToGlobalAgent = Wo.get = void 0
	var c3 = require("https"),
		het = require("tls"),
		hue = require("child_process"),
		gue = Yae(),
		qd = fue()
	Object.defineProperty(Wo, "Format", {
		enumerable: !0,
		get: function () {
			return qd.Format
		},
	})
	Object.defineProperty(Wo, "convert", {
		enumerable: !0,
		get: function () {
			return qd.convert
		},
	})
	var pue = process.platform === "darwin",
		Aue = c3.globalAgent,
		QT = {
			keychain: "all",
			unique: !0,
			excludeBundled: !0,
			format: qd.Format.pem,
		}
	function mue(e) {
		if ((e === void 0 && (e = QT), !pue)) return []
		e = vh(vh({}, QT), e)
		var t = /(?=-----BEGIN\sCERTIFICATE-----)/g,
			r = ["find-certificate", "-a", "-p"],
			n = []
		if (e.keychain === "all" || e.keychain === "SystemRootCertificates") {
			var i = "/System/Library/Keychains/SystemRootCertificates.keychain",
				s = (0, hue.spawnSync)("/usr/bin/security", r.concat(i))
					.stdout.toString()
					.split(t)
					.map(function (c) {
						return c.trim()
					})
			n = MT(MT([], n, !0), s, !0)
		}
		if (e.keychain === "all" || e.keychain === "current") {
			var o = (0, hue.spawnSync)("/usr/bin/security", r)
				.stdout.toString()
				.split(t)
				.map(function (c) {
					return c.trim()
				})
			n = MT(MT([], n, !0), o, !0)
		}
		if (e.unique || e.excludeBundled) {
			var a = n.map(function (c) {
					return (0, qd.convert)(c, qd.Format.fingerprint)
				}),
				l = e.excludeBundled
					? het.rootCertificates.map(function (c) {
							return (0, qd.convert)(c, qd.Format.fingerprint)
						})
					: []
			n = n.filter(function (c, u) {
				var f = a[u]
				return !((e.unique && u !== a.indexOf(f)) || (e.excludeBundled && l.includes(f)))
			})
		}
		return n.map(function (c) {
			return (0, qd.convert)(c, e.format)
		})
	}
	Wo.get = mue
	var FT = Aue.options.ca,
		get = function (e) {
			if ((e === void 0 && (e = QT), !!pue)) {
				var t
				Array.isArray(FT) ? (t = Array.from(FT)) : (t = typeof FT < "u" ? [FT] : []),
					mue(vh(vh(vh({}, QT), e), { format: qd.Format.pem, excludeBundled: !1 })).forEach(function (r) {
						return t.push(r)
					}),
					(Aue.options.ca = t),
					(c3.Agent = (function (r) {
						return function (n) {
							var i = typeof n < "u" ? vh({}, n) : {}
							return typeof i.ca > "u" && (i.ca = t), r.call(this, i)
						}
					})(c3.Agent)),
					(0, gue.setGlobalDispatcher)(new gue.Agent({ connect: { ca: t } }))
			}
		}
	Wo.addToGlobalAgent = get
})