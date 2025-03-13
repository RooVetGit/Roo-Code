import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import os from "os"
import { logger } from "../../utils/logging"

/**
 * Checks if VS Code is running in a remote SSH context
 * @returns boolean indicating if running in remote SSH
 */
export function isRemoteSSH(): boolean {
  // Check if running in a remote context
  const isRemote = vscode.env.remoteName !== undefined
  
  // Check if the remote is SSH (not DevContainers or WSL)
  const isSSH = vscode.env.remoteName === 'ssh-remote'
  
  return isRemote && isSSH
}

/**
 * Checks if an AWS profile exists in the credentials or config files
 * @param profile The profile name to check
 * @returns Promise<boolean> indicating if the profile exists
 */
export async function doesAwsProfileExist(profile: string): Promise<boolean> {
  try {
    // Check ~/.aws/credentials
    const credentialsPath = path.join(os.homedir(), '.aws', 'credentials')
    try {
      const credentialsExists = await fileExists(credentialsPath)
      if (credentialsExists) {
        const content = await fs.readFile(credentialsPath, 'utf8')
        if (content.includes(`[${profile}]`)) {
          return true
        }
      }
    } catch (error) {
      logger.debug("Error checking AWS credentials file", {
        ctx: "aws-profile",
        error: error instanceof Error ? error.message : String(error),
      })
    }
    
    // Check ~/.aws/config
    const configPath = path.join(os.homedir(), '.aws', 'config')
    try {
      const configExists = await fileExists(configPath)
      if (configExists) {
        const content = await fs.readFile(configPath, 'utf8')
        if (content.includes(`[profile ${profile}]`)) {
          return true
        }
      }
    } catch (error) {
      logger.debug("Error checking AWS config file", {
        ctx: "aws-profile",
        error: error instanceof Error ? error.message : String(error),
      })
    }
    
    return false
  } catch (error) {
    // If there's an error reading the files, log it and assume the profile doesn't exist
    logger.error("Error checking for AWS profile existence", {
      ctx: "aws-profile",
      profile,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Helper function to check if a file exists
 * @param filePath Path to the file
 * @returns Promise<boolean> indicating if the file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Shows an error notification about missing AWS profile in remote SSH context
 * @param profile The AWS profile name
 */
export function showRemoteProfileError(profile: string): void {
  const errorMessage = 
    `AWS Profile "${profile}" not found in the remote SSH host. ` +
    `When using VS Code with remote SSH, AWS profiles must exist on the remote machine. ` +
    `Please either create the profile on the remote machine or use direct AWS credentials instead.`
  
  // Log a warning that will be visible in the output panel
  logger.warn(errorMessage, {
    ctx: "bedrock",
    profile,
    isRemoteSSH: true
  })
  
  // Show a notification to the user
  vscode.window.showErrorMessage(errorMessage)
}

/**
 * Generates a detailed error message for AWS profile issues in remote SSH context
 * @param profile The AWS profile name
 * @returns A detailed error message with instructions
 */
export function getDetailedRemoteProfileErrorMessage(profile: string): string {
  return `Error: Could not find AWS profile "${profile}" on the remote SSH host.
      
When using VS Code with remote SSH, AWS profiles must exist on the remote machine.

Options to resolve this issue:
1. Create the AWS profile on the remote machine
2. Switch to using direct AWS credentials instead of a profile
3. Copy your AWS credentials from your local machine to the remote machine`
}