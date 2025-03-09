type WaitForOptions = {
	timeout?: number
	interval?: number
}

export const waitFor = (condition: () => boolean, { timeout = 10_000, interval = 250 }: WaitForOptions = {}) =>
	Promise.race([
		new Promise<void>((resolve) => {
			const check = () => (condition() ? resolve() : setTimeout(check, interval))
			check()
		}),
		new Promise((_, reject) =>
			setTimeout(() => {
				console.log(`Timeout after ${Math.floor(timeout / 1000)}s`)
				reject(new Error(`Timeout after ${Math.floor(timeout / 1000)}s`))
			}, timeout),
		),
	])
