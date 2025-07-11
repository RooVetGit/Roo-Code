# Git Authentication Issue Investigation and Fix

## Problem Summary

The issue with creating and pushing remote git branches was caused by missing environment variables and improper git authentication configuration for HTTPS operations.

## Root Causes Identified

1. **Missing HOME Environment Variable**: The `$HOME` environment variable was not set, causing git to fail when trying to access global configuration files.

2. **No Git Credential Helper**: Git was not configured with a credential helper to manage authentication for HTTPS operations.

3. **Missing Git Credentials**: Although the `GH_TOKEN` environment variable was available, git was not configured to use it for authentication.

## Error Messages Encountered

- Initial error reported: `Permission denied (publickey)`
- Actual error during testing: `fatal: could not read Username for 'https://github.com': No such device or address`
- Global config error: `fatal: $HOME not set`

## Investigation Results

### Environment Analysis

- **Current user**: `root`
- **Working directory**: `/roo/repos/Roo-Code`
- **GitHub CLI status**: ✅ Properly authenticated as `roomote-bot`
- **GitHub token**: ✅ Available as `GH_TOKEN` environment variable
- **Git remote configuration**: ✅ Properly configured to use HTTPS (`https://github.com/RooCodeInc/Roo-Code.git`)

### Configuration Issues Found

- `$HOME` environment variable: ❌ Not set
- Git credential helper: ❌ Not configured
- Git credentials file: ❌ Missing
- Global git configuration: ❌ Inaccessible due to missing `$HOME`

## Solution Implemented

### 1. Environment Setup

```bash
export HOME=/root
```

### 2. Git Credential Configuration

```bash
git config --global credential.helper store
```

### 3. GitHub Token Authentication

```bash
echo "https://roomote-bot:$GH_TOKEN@github.com" > ~/.git-credentials
```

### 4. Automated Setup Script

Created `scripts/setup-git-auth.sh` to automate the fix and ensure consistent configuration.

## Testing Results

After implementing the fix:

- ✅ Successfully created a test branch: `test-branch-push-investigation`
- ✅ Successfully pushed the branch to remote repository
- ✅ Git authentication working properly for HTTPS operations

## Recommendations

### Immediate Actions

1. Run the setup script: `./scripts/setup-git-auth.sh`
2. Ensure `$HOME` environment variable is set in your shell profile
3. Verify git operations work as expected

### Long-term Solutions

1. **Environment Configuration**: Ensure `$HOME` is set in system environment or container configuration
2. **Automated Setup**: Include the git authentication setup in deployment/initialization scripts
3. **Documentation**: Keep this documentation updated for future reference

### Prevention

1. Add environment variable checks to CI/CD pipelines
2. Include git authentication verification in health checks
3. Document required environment variables for development setup

## Usage

To fix git authentication issues, run:

```bash
./scripts/setup-git-auth.sh
```

This script will:

- Set the `$HOME` environment variable if missing
- Configure git credential helper
- Set up GitHub token authentication
- Test the configuration
- Provide clear feedback on the setup status

## Technical Details

### Git Configuration After Fix

- **Credential helper**: `store`
- **Authentication method**: HTTPS with token
- **Credentials location**: `~/.git-credentials`
- **Remote URL**: `https://github.com/RooCodeInc/Roo-Code.git`

### Environment Variables Required

- `GH_TOKEN`: GitHub personal access token
- `HOME`: User home directory path (set to `/root`)

## Troubleshooting

If you encounter similar issues in the future:

1. Check if `$HOME` is set: `echo $HOME`
2. Verify GitHub token is available: `echo $GH_TOKEN | head -c 10`
3. Check git credential helper: `git config --get credential.helper`
4. Test git authentication: `git ls-remote origin`
5. Run the setup script: `./scripts/setup-git-auth.sh`
