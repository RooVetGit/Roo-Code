
	var { kConnected: Cse, kSize: vse } = Qn(),
		SV = class {
			constructor(t) {
				this.value = t
			}
			deref() {
				return this.value[Cse] === 0 && this.value[vse] === 0 ? void 0 : this.value
			}
		},
		BV = class {
			constructor(t) {
				this.finalizer = t
			}
			register(t, r) {
				t.on &&
					t.on("disconnect", () => {
						t[Cse] === 0 && t[vse] === 0 && this.finalizer(r)
					})
			}
			unregister(t) {}
		}