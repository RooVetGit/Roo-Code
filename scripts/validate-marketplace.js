#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const yaml = require("yaml")

// Simple validation script for marketplace files
function validateMarketplaceFiles() {
	const marketplaceDir = path.join(__dirname, "..", "marketplace")

	console.log("🔍 Validating marketplace files...\n")

	// Check mcps.yml
	try {
		const mcpsPath = path.join(marketplaceDir, "mcps.yml")
		const mcpsContent = fs.readFileSync(mcpsPath, "utf-8")
		const mcpsData = yaml.parse(mcpsContent)

		console.log("✅ mcps.yml is valid YAML")
		console.log(`   Found ${mcpsData.items.length} MCP server(s)`)

		// Check for Daft.ie MCP
		const daftieServer = mcpsData.items.find((item) => item.id === "daft-ie-mcp")
		if (daftieServer) {
			console.log("✅ Daft.ie MCP Server found")
			console.log(`   Name: ${daftieServer.name}`)
			console.log(`   Author: ${daftieServer.author}`)
			console.log(`   URL: ${daftieServer.url}`)
			console.log(`   Tags: ${daftieServer.tags.join(", ")}`)
			console.log(`   Installation methods: ${daftieServer.content.length}`)
		} else {
			console.log("❌ Daft.ie MCP Server not found")
		}
	} catch (error) {
		console.log("❌ Error validating mcps.yml:", error.message)
	}

	console.log("")

	// Check modes.yml
	try {
		const modesPath = path.join(marketplaceDir, "modes.yml")
		const modesContent = fs.readFileSync(modesPath, "utf-8")
		const modesData = yaml.parse(modesContent)

		console.log("✅ modes.yml is valid YAML")
		console.log(`   Found ${modesData.items.length} mode(s)`)

		// Check for Property Search mode
		const propertyMode = modesData.items.find((item) => item.id === "property-search-mode")
		if (propertyMode) {
			console.log("✅ Property Search Mode found")
			console.log(`   Name: ${propertyMode.name}`)
			console.log(`   Author: ${propertyMode.author}`)
			console.log(`   Tags: ${propertyMode.tags.join(", ")}`)
		} else {
			console.log("❌ Property Search Mode not found")
		}
	} catch (error) {
		console.log("❌ Error validating modes.yml:", error.message)
	}

	console.log("\n🎉 Marketplace validation complete!")
}

validateMarketplaceFiles()
