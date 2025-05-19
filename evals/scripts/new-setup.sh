#!/bin/bash

# --- Configuration ---
MIN_NODE_MAJOR_VERSION=18 # Minimum Node.js major version needed to RUN new-setup.mjs
REQUIRED_NODE_VERSION="20.18.1" # Exact version needed by the project
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
NODE_SCRIPT_PATH="$SCRIPT_DIR/new-setup.mjs"
# Assuming setup.sh is in evals/scripts, ROOT_DIR is evals/
ROOT_DIR=$(dirname "$SCRIPT_DIR")

# --- Helper Functions ---
log_info() {
  echo -e "\033[0;34m💡 $1\033[0m"
}
log_success() {
  echo -e "\033[0;32m✅ $1\033[0m"
}
log_warning() {
  echo -e "\033[0;33m⚠️ $1\033[0m"
}
log_error() {
  echo -e "\033[0;31m🚨 $1\033[0m" >&2
}
log_guide() {
  echo -e "\033[0;35m🔗 $1\033[0m"
}

command_exists() {
  command -v "$1" &>/dev/null
}

source_nvm() {
  # Try to source nvm if it exists and isn't already sourced
  if [ -z "$NVM_DIR" ] || ! command_exists nvm; then
      export NVM_DIR="$HOME/.nvm"
      # shellcheck source=/dev/null
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  fi
  command_exists nvm # Return status of nvm command existence
}

source_asdf() {
    # Try to source asdf if it exists and isn't already sourced
    if ! command_exists asdf; then
        local asdf_dir
        asdf_dir=$(brew --prefix asdf 2>/dev/null || echo "$HOME/.asdf")
        if [ -s "$asdf_dir/asdf.sh" ]; then
            # shellcheck source=/dev/null
            . "$asdf_dir/asdf.sh"
        elif [ -s "$asdf_dir/libexec/asdf.sh" ]; then # Handle brew install location
            # shellcheck source=/dev/null
            . "$asdf_dir/libexec/asdf.sh"
        fi
    fi
    command_exists asdf # Return status of asdf command existence
}


# --- Main Logic ---
log_info "Bootstrapping Evals Setup..."

# 1. Check for a working Node.js (basic check >= MIN_NODE_MAJOR_VERSION)
NODE_EXECUTABLE=""
if command_exists node; then
    NODE_EXECUTABLE="node"
elif command_exists nodejs; then
    NODE_EXECUTABLE="nodejs"
fi

if [ -z "$NODE_EXECUTABLE" ]; then
    log_error "Node.js not found in PATH."
    log_guide "Please install Node.js version ${MIN_NODE_MAJOR_VERSION} or higher."
    log_guide "Visit: https://nodejs.org/"
    exit 1
fi

current_bootstrap_version=$($NODE_EXECUTABLE --version)
current_bootstrap_major=$(echo "$current_bootstrap_version" | sed 's/^v//' | cut -d. -f1)

if ! [[ "$current_bootstrap_major" =~ ^[0-9]+$ ]] || [ "$current_bootstrap_major" -lt "$MIN_NODE_MAJOR_VERSION" ]; then
    log_error "Found Node.js ${current_bootstrap_version}, but version ${MIN_NODE_MAJOR_VERSION} or higher is required to run the setup script."
    log_guide "Please install or switch to a compatible Node.js version and re-run this script."
    exit 1
fi

log_success "Found compatible Node.js for bootstrapping: $current_bootstrap_version"

# 2. Check if the *active* Node version is the *exact* required version
current_exact_version=$(echo "$current_bootstrap_version" | sed 's/^v//')
log_info "Checking active Node.js version ($current_exact_version) against required ($REQUIRED_NODE_VERSION)..."

NODE_EXIT_CODE=0 # Default to success

if [ "$current_exact_version" == "$REQUIRED_NODE_VERSION" ]; then
    log_success "Active Node.js version is correct."
    # Execute directly
    "$NODE_EXECUTABLE" "$NODE_SCRIPT_PATH" "$@"
    NODE_EXIT_CODE=$?
else
    log_warning "Active Node.js version ($current_exact_version) is not the required ($REQUIRED_NODE_VERSION)."
    log_info "Attempting to run setup script using a version manager..."

    EXECUTED_VIA_MANAGER=false

    # Try NVM exec
    if source_nvm; then
        log_info "NVM detected. Attempting via 'nvm exec'..."
        # Check if the required version is installed by nvm
        if nvm list "$REQUIRED_NODE_VERSION" &>/dev/null; then
            log_info "Node.js v${REQUIRED_NODE_VERSION} found in nvm. Executing..."
            nvm exec "$REQUIRED_NODE_VERSION" node "$NODE_SCRIPT_PATH" "$@"
            NODE_EXIT_CODE=$?
            EXECUTED_VIA_MANAGER=true
        else
            log_warning "Node.js v${REQUIRED_NODE_VERSION} not found in nvm."
            read -p "Install Node.js v${REQUIRED_NODE_VERSION} using nvm? (Y/n): " install_nvm_node
            if [[ "$install_nvm_node" =~ ^[Yy]|^$ ]]; then
                log_info "Installing Node.js v${REQUIRED_NODE_VERSION} with nvm..."
                if nvm install "$REQUIRED_NODE_VERSION"; then
                    log_info "Installation successful. Executing..."
                    nvm exec "$REQUIRED_NODE_VERSION" node "$NODE_SCRIPT_PATH" "$@"
                    NODE_EXIT_CODE=$?
                    EXECUTED_VIA_MANAGER=true
                else
                    log_error "nvm install failed."
                    NODE_EXIT_CODE=1
                fi
            else
                log_info "Skipping nvm install."
                NODE_EXIT_CODE=1 # Indicate failure to run automatically
            fi
        fi
    else
        log_info "NVM not detected or failed to source."
    fi

    # Try ASDF exec (if nvm didn't run or isn't present/sourced)
    if [ "$EXECUTED_VIA_MANAGER" = false ] && source_asdf; then
        log_info "ASDF detected. Attempting via 'asdf exec'..."
        # Ensure asdf nodejs plugin is added
        if ! asdf plugin-list | grep -q "nodejs"; then
           log_info "Adding asdf nodejs plugin..."
           asdf plugin add nodejs || log_warning "Failed to add asdf nodejs plugin."
        fi

        # Check if version installed, if not, try installing
        if ! asdf list nodejs "$REQUIRED_NODE_VERSION" &>/dev/null; then
            log_warning "Node.js v${REQUIRED_NODE_VERSION} not found in asdf."
            read -p "Install Node.js v${REQUIRED_NODE_VERSION} using asdf? (Y/n): " install_asdf_node
             if [[ "$install_asdf_node" =~ ^[Yy]|^$ ]]; then
                log_info "Installing Node.js v${REQUIRED_NODE_VERSION} with asdf..."
                if ! asdf install nodejs "$REQUIRED_NODE_VERSION"; then
                    log_error "asdf install failed."
                    NODE_EXIT_CODE=1
                fi
             else
                 log_info "Skipping asdf install."
                 NODE_EXIT_CODE=1 # Indicate failure to run automatically
             fi
        fi

        # Proceed if install succeeded or was skipped but version might exist anyway
        if [ $NODE_EXIT_CODE -eq 0 ]; then
             log_info "Executing with asdf..."
             # ASDF uses .tool-versions or global. We assume it's set correctly if installed.
             # Run from ROOT_DIR (evals/) in case .tool-versions exists there
             (cd "$ROOT_DIR" && asdf exec node "$NODE_SCRIPT_PATH" "$@")
             NODE_EXIT_CODE=$?
             EXECUTED_VIA_MANAGER=true
        fi
    elif [ "$EXECUTED_VIA_MANAGER" = false ]; then
         log_info "ASDF not detected or failed to source."
    fi

    # If still not executed successfully via manager, fall back to manual instructions
    if [ "$EXECUTED_VIA_MANAGER" = false ] || [ $NODE_EXIT_CODE -ne 0 ]; then
        log_error "Could not automatically run setup with Node.js v${REQUIRED_NODE_VERSION} using nvm or asdf."
        log_guide "Please manually switch to Node.js v${REQUIRED_NODE_VERSION} using your version manager."
        log_guide "Example (nvm): nvm install ${REQUIRED_NODE_VERSION} && nvm use ${REQUIRED_NODE_VERSION}"
        log_guide "Example (asdf): asdf install nodejs ${REQUIRED_NODE_VERSION} && asdf global nodejs ${REQUIRED_NODE_VERSION} (or local)"
        log_guide "Then, re-run this setup script (./evals/scripts/setup.sh)."
        # Ensure exit code reflects failure if we reach here after failed attempts
        if [ $NODE_EXIT_CODE -eq 0 ]; then NODE_EXIT_CODE=1; fi
    fi
fi


# Final exit code check
if [ $NODE_EXIT_CODE -ne 0 ]; then
  log_error "Setup script failed with exit code $NODE_EXIT_CODE."
  exit $NODE_EXIT_CODE
fi

log_success "Setup script finished successfully."
exit 0
