
var Ms = class e {
		constructor() {
			this.value = "valid"
		}
		dirty() {
			this.value === "valid" && (this.value = "dirty")
		}
		abort() {
			this.value !== "aborted" && (this.value = "aborted")
		}
		static mergeArray(t, r) {
			let n = []
			for (let i of r) {
				if (i.status === "aborted") return vt
				i.status === "dirty" && t.dirty(), n.push(i.value)
			}
			return { status: t.value, value: n }
		}
		static async mergeObjectAsync(t, r) {
			let n = []
			for (let i of r) {
				let s = await i.key,
					o = await i.value
				n.push({ key: s, value: o })
			}
			return e.mergeObjectSync(t, n)
		}
		static mergeObjectSync(t, r) {
			let n = {}
			for (let i of r) {
				let { key: s, value: o } = i
				if (s.status === "aborted" || o.status === "aborted") return vt
				s.status === "dirty" && t.dirty(),
					o.status === "dirty" && t.dirty(),
					s.value !== "__proto__" && (typeof o.value < "u" || i.alwaysSet) && (n[s.value] = o.value)
			}
			return { status: t.value, value: n }
		}
	},
	vt = Object.freeze({ status: "aborted" }),
	tm = (e) => ({ status: "dirty", value: e }),
	ro = (e) => ({ status: "valid", value: e }),
	pP = (e) => e.status === "aborted",
	AP = (e) => e.status === "dirty",
	wg = (e) => e.status === "valid",
	Fv = (e) => typeof Promise < "u" && e instanceof Promise