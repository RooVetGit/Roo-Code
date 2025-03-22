import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { ThemeProvider, ReactQueryProvider } from "@/components/providers"
import { Header } from "@/components/layout/header"

import "./globals.css"

const fontSans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const fontMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] })

export const metadata: Metadata = {
	title: "Roo Code Benchmarks",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en">
			<body className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<ReactQueryProvider>
						<Header />
						<div className="max-w-3xl mx-auto">{children}</div>
					</ReactQueryProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
