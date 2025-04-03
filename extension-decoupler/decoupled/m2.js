
				function M2(d, h) {
					if (!(h === "constructor" && typeof d[h] == "function") && h != "__proto__") return d[h]
				}