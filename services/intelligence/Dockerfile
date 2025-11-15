FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and certificates for TLS (mirror memory service setup)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "main.py"]
