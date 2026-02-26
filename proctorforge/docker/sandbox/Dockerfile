# ProctorForge AI - Code Execution Sandbox
# Minimal Python sandbox with restricted I/O

FROM python:3.12-slim

# Security: Create non-root user
RUN groupadd -r sandbox && useradd -r -g sandbox -d /home/sandbox -m sandbox

# No network access
# Install only safe packages
RUN pip install --no-cache-dir numpy 2>/dev/null || true

# Create workspace
WORKDIR /sandbox
RUN chown sandbox:sandbox /sandbox

# Restrict filesystem
RUN chmod 755 /sandbox

# Switch to sandbox user
USER sandbox

# Default entrypoint: run provided code
ENTRYPOINT ["python3", "-c"]
