FROM python:3.11-slim

# Install system dependencies and certificates for TLS
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
# Upgrade pip tooling first to avoid resolver/metadata issues behind proxies
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt

# Copy application code
COPY . .

# Run the scheduler
CMD ["python", "main.py"]
