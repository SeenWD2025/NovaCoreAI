FROM python:3.11-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .

# Pre-download the CPU-only PyTorch wheel with retry/resume to avoid flaky installs
ARG TORCH_CPU_WHL=https://download.pytorch.org/whl/cpu/torch-2.3.1%2Bcpu-cp311-cp311-linux_x86_64.whl
RUN curl -L --retry 5 --retry-delay 5 --continue-at - "$TORCH_CPU_WHL" -o torch_cpu.whl \
    && pip install --no-cache-dir torch_cpu.whl \
    && rm torch_cpu.whl

RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host download.pytorch.org -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8001

# Run the application
CMD ["python", "main.py"]
