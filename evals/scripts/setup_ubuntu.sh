#!/usr/bin/env bash

# Ensure we're running with bash
if [ -z "$BASH_VERSION" ]; then
    echo "This script must be run with bash"
    exit 1
fi

menu() {
  echo -e "\n📋 Which eval types would you like to support?\n"

  for i in ${!options[@]}; do
    printf " %d) %-6s [%s]" $((i + 1)) "${options[i]}" "${choices[i]:- }"

    if [[ $i == 0 ]]; then
      printf " (required)"
    fi

    printf "\n"
  done

  echo -e " q) quit\n"
}

has_asdf_plugin() {
  local plugin="$1"
  case "$plugin" in
    nodejs|python|golang|rust) echo "true" ;;
    *) echo "false" ;;
  esac
}

build_extension() {
  echo "🔨 Building the Roo Code extension..."
  cd ..
  mkdir -p bin
  npm run install-extension -- --silent --no-audit || exit 1
  npm run install-webview -- --silent --no-audit || exit 1
  npm run install-e2e -- --silent --no-audit || exit 1
  npx vsce package --out bin/roo-code-latest.vsix || exit 1
  code --install-extension bin/roo-code-latest.vsix || exit 1
  cd evals
}

# Detect OS type
OS_TYPE=$(uname -s)
if [[ "$OS_TYPE" != "Linux" ]]; then
  echo "⚠️ This script is now configured for Ubuntu Linux only."
  exit 1
fi

# Check if running on Ubuntu
if ! command -v lsb_release &>/dev/null || [[ "$(lsb_release -si)" != "Ubuntu" ]]; then
  echo "⚠️ This script is only supported on Ubuntu Linux."
  exit 1
fi

options=("nodejs" "python" "golang" "rust" "java")
binaries=("node" "python" "go" "rustc" "javac")

for i in "${!options[@]}"; do
  choices[i]="*"
done

prompt="Type 1-5 to select, 'q' to quit, ⏎ to continue: "

while menu && read -rp "$prompt" num && [[ "$num" ]]; do
  [[ "$num" == "q" ]] && exit 0

  [[ "$num" != *[![:digit:]]* ]] &&
    ((num > 1 && num <= ${#options[@]})) ||
    {
      continue
    }

  ((num--))
  [[ "${choices[num]}" ]] && choices[num]="" || choices[num]="*"
done

empty=true

for i in ${!options[@]}; do
  [[ "${choices[i]}" ]] && {
    empty=false
    break
  }
done

[[ "$empty" == true ]] && exit 0

printf "\n"

# Update package lists
echo "🔄 Updating package lists..."
sudo apt-get update || exit 1

# Install required system packages
echo "📦 Installing required system packages..."
sudo apt-get install -y \
  curl \
  git \
  build-essential \
  pkg-config \
  libssl-dev \
  || exit 1

# Install asdf
if ! command -v asdf &>/dev/null; then
  echo "🛠️ Installing asdf..."
  git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.13.1 || exit 1
  
  # Add asdf to shell configuration
  if [[ "$SHELL" == */bash ]]; then
    echo ". \"\$HOME/.asdf/asdf.sh\"" >> ~/.bashrc
    echo ". \"\$HOME/.asdf/completions/asdf.bash\"" >> ~/.bashrc
  elif [[ "$SHELL" == */zsh ]]; then
    echo ". \"\$HOME/.asdf/asdf.sh\"" >> ~/.zshrc
    echo ". \"\$HOME/.asdf/completions/asdf.zsh\"" >> ~/.zshrc
  fi

  . "$HOME/.asdf/asdf.sh"
  ASDF_VERSION=$(asdf --version)
  echo "✅ asdf is installed ($ASDF_VERSION)"
else
  ASDF_VERSION=$(asdf --version)
  echo "✅ asdf is installed ($ASDF_VERSION)"
fi

# Install GitHub CLI
if ! command -v gh &>/dev/null; then
  echo "👨‍💻 Installing GitHub CLI..."
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y gh
  GH_VERSION=$(gh --version | head -n 1)
  echo "✅ gh is installed ($GH_VERSION)"
  gh auth status || gh auth login -w -p https
else
  GH_VERSION=$(gh --version | head -n 1)
  echo "✅ gh is installed ($GH_VERSION)"
fi

for i in "${!options[@]}"; do
  [[ "${choices[i]}" ]] || continue

  plugin="${options[$i]}"
  binary="${binaries[$i]}"

  if [[ "$(has_asdf_plugin "$plugin")" == "true" ]]; then
    if ! asdf plugin list | grep -q "^${plugin}$" && ! command -v "${binary}" &>/dev/null; then
      echo "📦 Installing ${plugin} asdf plugin..."
      asdf plugin add "${plugin}" || exit 1
      echo "✅ asdf ${plugin} plugin installed successfully"
    fi
  fi

  case "${plugin}" in
  "nodejs")
    if ! command -v node &>/dev/null; then
      asdf install nodejs v20.18.1 || exit 1
      asdf set nodejs v20.18.1 || exit 1
      NODE_VERSION=$(node --version)
      echo "✅ Node.js is installed ($NODE_VERSION)"
    else
      NODE_VERSION=$(node --version)
      echo "✅ Node.js is installed ($NODE_VERSION)"
    fi

    if [[ $(node --version) != "v20.18.1" ]]; then
      NODE_VERSION=$(node --version)
      echo "🚨 You have the wrong version of node installed ($NODE_VERSION)."
      echo "💡 If you are using nvm then run 'nvm install' to install the version specified by the repo's .nvmrc."
      exit 1
    fi
    ;;

  "python")
    if ! command -v python &>/dev/null; then
      asdf install python 3.13.2 || exit 1
      asdf set python 3.13.2 || exit 1
      PYTHON_VERSION=$(python --version)
      echo "✅ Python is installed ($PYTHON_VERSION)"
    else
      PYTHON_VERSION=$(python --version)
      echo "✅ Python is installed ($PYTHON_VERSION)"
    fi

    if ! command -v uv &>/dev/null; then
      curl -LsSf https://astral.sh/uv/install.sh | sh
      UV_VERSION=$(uv --version)
      echo "✅ uv is installed ($UV_VERSION)"
    else
      UV_VERSION=$(uv --version)
      echo "✅ uv is installed ($UV_VERSION)"
    fi
    ;;

  "golang")
    if ! command -v go &>/dev/null; then
      asdf install golang 1.24.2 || exit 1
      asdf set golang 1.24.2 || exit 1
      GO_VERSION=$(go version)
      echo "✅ Go is installed ($GO_VERSION)"
    else
      GO_VERSION=$(go version)
      echo "✅ Go is installed ($GO_VERSION)"
    fi
    ;;

  "rust")
    if ! command -v rustc &>/dev/null; then
      asdf install rust 1.85.1 || exit 1
      asdf set rust 1.85.1 || exit 1
      RUST_VERSION=$(rustc --version)
      echo "✅ Rust is installed ($RUST_VERSION)"
    else
      RUST_VERSION=$(rustc --version)
      echo "✅ Rust is installed ($RUST_VERSION)"
    fi
    ;;

  "java")
    if ! command -v javac &>/dev/null || ! javac --version &>/dev/null; then
      echo "☕ Installing Java..."
      sudo apt-get install -y openjdk-17-jdk || exit 1
      
      # Update alternatives
      sudo update-alternatives --set java /usr/lib/jvm/java-17-openjdk-amd64/bin/java
      sudo update-alternatives --set javac /usr/lib/jvm/java-17-openjdk-amd64/bin/javac
      
      JAVA_VERSION=$(javac --version | head -n 1)
      echo "✅ Java is installed ($JAVA_VERSION)"
    else
      JAVA_VERSION=$(javac --version | head -n 1)
      echo "✅ Java is installed ($JAVA_VERSION)"
    fi
    ;;
  esac
done

# Install pnpm
if ! command -v pnpm &>/dev/null; then
  echo "📦 Installing pnpm..."
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  PNPM_VERSION=$(pnpm --version)
  echo "✅ pnpm is installed ($PNPM_VERSION)"
else
  PNPM_VERSION=$(pnpm --version)
  echo "✅ pnpm is installed ($PNPM_VERSION)"
fi

pnpm install --silent || exit 1

if [[ ! -d "../../evals" ]]; then
  if gh auth status &>/dev/null; then
    read -p "🔗 Would you like to be able to share eval results? (Y/n): " fork_evals

    if [[ "$fork_evals" =~ ^[Yy]|^$ ]]; then
      gh repo fork cte/evals --clone ../../evals || exit 1
    else
      gh repo clone cte/evals ../../evals || exit 1
    fi
  else
    git clone https://github.com/cte/evals.git ../../evals || exit 1
  fi
fi

if [[ ! -s .env ]]; then
  cp .env.sample .env || exit 1
fi

if [[ ! -s /tmp/evals.db ]]; then
  echo "🗄️ Creating database..."
  pnpm --filter @evals/db db:push || exit 1
  pnpm --filter @evals/db db:enable-wal || exit 1
fi

if ! grep -q "OPENROUTER_API_KEY" .env; then
  read -p "🔐 Enter your OpenRouter API key (sk-or-v1-...): " openrouter_api_key
  echo "🔑 Validating..."
  curl --silent --fail https://openrouter.ai/api/v1/key -H "Authorization: Bearer $openrouter_api_key" &>/dev/null || exit 1
  echo "OPENROUTER_API_KEY=$openrouter_api_key" >> .env || exit 1
fi

if ! command -v code &>/dev/null; then
  echo "⚠️ Visual Studio Code cli is not installed"
  exit 1
else
  VSCODE_VERSION=$(code --version | head -n 1)
  echo "✅ Visual Studio Code is installed ($VSCODE_VERSION)"
fi

if [[ ! -s "../bin/roo-code-latest.vsix" ]]; then
  build_extension
else
  read -p "💻 Do you want to build a new version of the Roo Code extension? (y/N): " build_extension

  if [[ "$build_extension" =~ ^[Yy]$ ]]; then
    build_extension
  fi
fi

echo -e "\n🚀 You're ready to rock and roll! \n"

if ! nc -z localhost 3000; then
  read -p "🌐 Would you like to start the evals web app? (Y/n): " start_evals

  if [[ "$start_evals" =~ ^[Yy]|^$ ]]; then
    pnpm web
  else
    echo "💡 You can start it anytime with 'pnpm web'."
  fi
else
  echo "👟 The evals web app is running at http://localhost:3000"
fi
