# docker -f benchmark/Dockerfile build -t roo-code-benchmark .
# docker run -d -p 2222:22 -it roo-code-benchmark

FROM ubuntu:latest

# Install dependencies
RUN apt update && apt install -y curl git

# Install VS Code
# https://code.visualstudio.com/docs/setup/linux
RUN apt update && apt install -y wget gpg apt-transport-https
RUN wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
RUN install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
RUN echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | tee /etc/apt/sources.list.d/vscode.list > /dev/null
RUN rm -f packages.microsoft.gpg
RUN apt update && apt install -y code

# Install Xvfb
RUN apt install -y xvfb

# Install SSH server
RUN apt install -y openssh-server
RUN mkdir -p /var/run/sshd && \
    echo 'PermitRootLogin no' >> /etc/ssh/sshd_config && \
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
RUN ssh-keygen -A

# Install node.js
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt update && apt install -y nodejs

# Create a `vscode` user
RUN apt install -y sudo && \
    useradd -m vscode -s /bin/bash && \
    echo "vscode ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/vscode && \
    chmod 0440 /etc/sudoers.d/vscode

WORKDIR /home/vscode
USER vscode

RUN mkdir -p /home/vscode/.ssh
RUN echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDKGzg3BQ0QHU4m6G6CAdQ57LnBVljlPWfdySrsjV3twQaOYoJ8eEy1ck7kYZfH7DIbCteH4hkNIk32ghjWE84j3unO2/3wGC+CId9raZMudi8UbNgAFMYZZqTcrWR1lCxSLpDNT01JHYHw4BCMkJ4XjH2so+b5t/OzKVqvLJHOVTE7aZARsqrdQdiAmd9bbArFIoaLnvHYvArPprLU9clfhQJrAXi484t4eK2h2lMtiitmHph9WpcTxYiDdEg4fxlA2yYDkQZGcjoNPFTBEP5RpmXMcNV7/Zb2U0rJIOPrFqIwZ5yG79Kic8ajPdtmGdVpYec/OlR1Oer0kfakU2RImTzJPZeGnXy/hvcQErAqgpzTLn7dz2YaWMYdcLm6HOmZl1nj3LauWmRcCB8cxM34GjFXMpNm+6Ey8pmgoCMGLdBjL5/xqT6PbQxbYgUJNXMc51qMX8C3lkX/muQD8pDaj5kLXJhYkCgVGwcoC+hbJAOYSry4NQ8aTsFmjyTkaTE= cte@monstera" > /home/vscode/.ssh/authorized_keys
RUN chown -R vscode:vscode /home/vscode/.ssh
RUN chmod 700 /home/vscode/.ssh
RUN chmod 600 /home/vscode/.ssh/authorized_keys

COPY benchmark/entrypoint.sh /usr/local/bin/
COPY --chown=vscode:vscode . /home/vscode/repo

RUN cd repo && npm run install:all

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/bin/bash"]

# FROM buildpack-deps:jammy

# # Install Python 3.11
# RUN apt-get update && apt-get install -y \
#     software-properties-common \
#     cmake \
#     libboost-all-dev \
#     && add-apt-repository ppa:deadsnakes/ppa \
#     && apt-get update \
#     && apt-get install -y \
#     python3.11 \
#     python3.11-venv \
#     python3.11-dev \
#     python3-pip \
#     ca-certificates-java \
#     openjdk-21-jdk \
#     libtbb-dev \
#     && rm -rf /var/lib/apt/lists/*

# # Make python3.11 the default python3
# RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# # Install Go with architecture detection
# RUN ARCH=$(uname -m) && \
#     if [ "$ARCH" = "x86_64" ]; then \
#         GOARCH="amd64"; \
#     elif [ "$ARCH" = "aarch64" ]; then \
#         GOARCH="arm64"; \
#     else \
#         false; \
#     fi && \
#     curl -L "https://golang.org/dl/go1.21.5.linux-$GOARCH.tar.gz" -o go.tar.gz && \
#     tar -C /usr/local -xzf go.tar.gz && \
#     rm go.tar.gz
# ENV PATH="/usr/local/go/bin:${PATH}"

# # Install Rust
# ADD https://sh.rustup.rs /tmp/rustup.sh
# RUN chmod +x /tmp/rustup.sh && /tmp/rustup.sh -y && rm /tmp/rustup.sh
# ENV PATH="/root/.cargo/bin:${PATH}"

# # Install Node.js and dependencies
# RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
#     apt-get install -y nodejs && \
#     rm -rf /var/lib/apt/lists/* && \
#     mkdir -p /npm-install && \
#     cd /npm-install && \
#     npm init -y && \
#     npm install \
#     jest \
#     @babel/core@7.25.2 \
#     @exercism/babel-preset-javascript@0.2.1 \
#     @exercism/eslint-config-javascript@0.6.0 \
#     @types/jest@29.5.12 \
#     @types/node@20.12.12 \
#     babel-jest@29.6.4 \
#     core-js@3.37.1 \
#     eslint@8.49.0

# COPY . /aider
# RUN pip3 install --no-cache-dir --upgrade pip uv
# RUN uv pip install --system --no-cache-dir -e /aider[dev]
# RUN git config --global --add safe.directory /aider
# WORKDIR /aider
