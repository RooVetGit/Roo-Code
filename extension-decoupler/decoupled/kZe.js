
	function KZe(e, t, r) {
		typeof t == "function" && ((r = t), (t = {})), (t = t || {})
		var n = {
			algorithm: {
				name: t.algorithm || "PRIMEINC",
				options: {
					workers: t.workers || 2,
					workLoad: t.workLoad || 100,
					workerScript: t.workerScript,
				},
			},
		}
		"prng" in t && (n.prng = t.prng), i()
		function i() {
			s(e.pBits, function (a, l) {
				if (a) return r(a)
				if (((e.p = l), e.q !== null)) return o(a, e.q)
				s(e.qBits, o)
			})
		}
		function s(a, l) {
			rt.prime.generateProbablePrime(a, n, l)
		}
		function o(a, l) {
			if (a) return r(a)
			if (((e.q = l), e.p.compareTo(e.q) < 0)) {
				var c = e.p
				;(e.p = e.q), (e.q = c)
			}
			if (e.p.subtract(br.ONE).gcd(e.e).compareTo(br.ONE) !== 0) {
				;(e.p = null), i()
				return
			}
			if (e.q.subtract(br.ONE).gcd(e.e).compareTo(br.ONE) !== 0) {
				;(e.q = null), s(e.qBits, o)
				return
			}
			if (
				((e.p1 = e.p.subtract(br.ONE)),
				(e.q1 = e.q.subtract(br.ONE)),
				(e.phi = e.p1.multiply(e.q1)),
				e.phi.gcd(e.e).compareTo(br.ONE) !== 0)
			) {
				;(e.p = e.q = null), i()
				return
			}
			if (((e.n = e.p.multiply(e.q)), e.n.bitLength() !== e.bits)) {
				;(e.q = null), s(e.qBits, o)
				return
			}
			var u = e.e.modInverse(e.phi)
			;(e.keys = {
				privateKey: kt.rsa.setPrivateKey(e.n, e.e, u, e.p, e.q, u.mod(e.p1), u.mod(e.q1), e.q.modInverse(e.p)),
				publicKey: kt.rsa.setPublicKey(e.n, e.e),
			}),
				r(null, e.keys)
		}
	}