# Dockerfile for Smart Grid AI Forecasting Dashboard
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Set working directory
WORKDIR /app

# Install system dependencies (build-essential needed for some C-extensions like SHAP if wheel not present)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency requirements
COPY requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy dataset, models, output logs, frontend dashboard, and app
COPY data/ data/
COPY models/ models/
COPY outputs/ outputs/
COPY dashboard/ dashboard/
COPY app.py .

# Expose default port
EXPOSE 8000

# Start Uvicorn server binding to 0.0.0.0
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
