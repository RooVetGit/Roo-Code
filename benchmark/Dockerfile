# docker build -f Dockerfile.base -t roo-code-benchmark-base ..
# docker build -f Dockerfile -t roo-code-benchmark ..
# docker run -d -it -p 3000:3000 -v /tmp/benchmarks.db:/tmp/benchmarks.db roo-code-benchmark
# docker exec -it $(docker ps --filter "ancestor=roo-code-benchmark" -q) /bin/bash

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN npm install -g npm@latest
RUN npm install -g npm-run-all

# Install dependencies
RUN apt update && apt install -y sudo curl git vim jq

# Create a `vscode` user
RUN useradd -m vscode -s /bin/bash && \
  echo "vscode ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/vscode && \
  chmod 0440 /etc/sudoers.d/vscode

# Install VS Code
# https://code.visualstudio.com/docs/setup/linux
RUN apt install -y wget gpg apt-transport-https
RUN wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
RUN install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
RUN echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | tee /etc/apt/sources.list.d/vscode.list > /dev/null
RUN rm -f packages.microsoft.gpg
RUN apt update && apt install -y code

# Install Xvfb
RUN apt install -y xvfb

# [cpp] Install cmake 3.28.3
RUN apt install -y cmake

# [go] Install Go 1.22.2
RUN apt install -y golang-go

# [java] Install Java 21
RUN apt install -y default-jre

# [python] Install Python 3.12.3 and uv 0.6.6
RUN apt install -y python3 python3-venv python3-dev python3-pip

# [rust] Install Rust 1.85
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
RUN echo 'source $HOME/.cargo/env' >> $HOME/.bashrc

WORKDIR /home/vscode
USER vscode

COPY benchmark/entrypoint.sh /usr/local/bin/entrypoint.sh

# Copy exercises
WORKDIR /home/vscode
RUN git clone https://github.com/cte/Roo-Code-Benchmark.git exercises

# Prepare exercises
WORKDIR /home/vscode/exercises/python
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN /home/vscode/.local/bin/uv sync

# Copy and build extension dependencies
WORKDIR /home/vscode/repo
COPY --chown=vscode:vscode package*.json /home/vscode/repo/
COPY --chown=vscode:vscode webview-ui/package*.json /home/vscode/repo/webview-ui/
RUN npm-run-all -l -p install-extension install-webview

# Copy extension and benchmark code
COPY --chown=vscode:vscode . /home/vscode/repo

# Build extension dependencies
WORKDIR /home/vscode/repo/benchmark
RUN pnpm install

# Initialize database
RUN echo "BENCHMARKS_DB_PATH=file:/tmp/benchmarks.db" > .env
RUN pnpm --filter @benchmark/db db:push

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/pnpm", "dev"]
