FROM python:3.12-slim

WORKDIR /service

# Install deps first so source-only changes don't bust the layer cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app
COPY app ./app

# .env is mounted at runtime via docker-compose, NOT baked into the image
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
