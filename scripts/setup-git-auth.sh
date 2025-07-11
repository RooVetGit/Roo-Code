#!/bin/bash

# Git Authentication Setup Script
# This script fixes the git authentication issues by setting up proper environment variables
# and git configuration for HTTPS authentication with GitHub tokens.

set -e

echo "Setting up Git authentication..."

# Set HOME environment variable if not set
if [ -z "$HOME" ]; then
    export HOME=/root
    echo "✓ Set HOME environment variable to /root"
fi

# Ensure the HOME directory exists
mkdir -p "$HOME"

# Configure git credential helper to use stored credentials
git config --global credential.helper store
echo "✓ Configured git credential helper"

# Set up git credentials using the GitHub token
if [ -n "$GH_TOKEN" ]; then
    echo "https://roomote-bot:$GH_TOKEN@github.com" > "$HOME/.git-credentials"
    echo "✓ Configured GitHub authentication with token"
else
    echo "⚠️  Warning: GH_TOKEN environment variable not found"
    echo "   Please ensure the GitHub token is available as GH_TOKEN"
fi

# Set git user configuration if not already set
if ! git config --global user.name >/dev/null 2>&1; then
    git config --global user.name "roomote-bot"
    echo "✓ Set git user.name to roomote-bot"
fi

if ! git config --global user.email >/dev/null 2>&1; then
    git config --global user.email "roomote-bot@users.noreply.github.com"
    echo "✓ Set git user.email"
fi

# Test git authentication
echo "Testing git authentication..."
if git ls-remote origin >/dev/null 2>&1; then
    echo "✅ Git authentication test successful!"
else
    echo "❌ Git authentication test failed"
    exit 1
fi

echo "Git authentication setup complete!"