# Runtime stage
FROM debian:stable

# Add metadata labels
LABEL org.opencontainers.image.title="Catalog CLI" \
    org.opencontainers.image.description="Lightweight CLI that scans Markdown directories to generate llms.txt and index.json files" \
    org.opencontainers.image.url="https://github.com/fwdslsh/catalog" \
    org.opencontainers.image.source="https://github.com/fwdslsh/catalog" \
    org.opencontainers.image.vendor="fwdslsh" \
    org.opencontainers.image.licenses="CC-BY-4.0"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    tzdata \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser

# Create working directory and set permissions
WORKDIR /workspace
RUN chown appuser:appgroup /workspace

# Switch to non-root user
USER appuser

# Install Catalog CLI
RUN curl -fsSL https://raw.githubusercontent.com/fwdslsh/catalog/main/install.sh | bash

# Set default entrypoint and command
ENTRYPOINT ["/home/appuser/.local/bin/catalog"]
