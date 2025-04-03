
var U5 = x((uBt, mce) => {
	"use strict"
	var ph = Yt()
	gc()
	dh()
	k5()
	_p()
	hT()
	P5()
	vT()
	Rb()
	Sr()
	xT()
	var L5 = ph.asn1,
		K0 = (mce.exports = ph.pki = ph.pki || {})
	K0.pemToDer = function (e) {
		var t = ph.pem.decode(e)[0]
		if (t.procType && t.procType.type === "ENCRYPTED")
			throw new Error("Could not convert PEM to DER; PEM is encrypted.")
		return ph.util.createBuffer(t.body)
	}
	K0.privateKeyFromPem = function (e) {
		var t = ph.pem.decode(e)[0]
		if (t.type !== "PRIVATE KEY" && t.type !== "RSA PRIVATE KEY") {
			var r = new Error(
				'Could not convert private key from PEM; PEM header type is not "PRIVATE KEY" or "RSA PRIVATE KEY".',
			)
			throw ((r.headerType = t.type), r)
		}
		if (t.procType && t.procType.type === "ENCRYPTED")
			throw new Error("Could not convert private key from PEM; PEM is encrypted.")
		var n = L5.fromDer(t.body)
		return K0.privateKeyFromAsn1(n)
	}
	K0.privateKeyToPem = function (e, t) {
		var r = {
			type: "RSA PRIVATE KEY",
			body: L5.toDer(K0.privateKeyToAsn1(e)).getBytes(),
		}
		return ph.pem.encode(r, { maxline: t })
	}
	K0.privateKeyInfoToPem = function (e, t) {
		var r = { type: "PRIVATE KEY", body: L5.toDer(e).getBytes() }
		return ph.pem.encode(r, { maxline: t })
	}
})