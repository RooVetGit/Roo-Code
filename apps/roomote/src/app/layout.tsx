import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Cloud Agents",
	description: "Roo Code task execution service",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	)
}
