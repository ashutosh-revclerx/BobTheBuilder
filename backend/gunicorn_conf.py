import os

bind = f"0.0.0.0:{os.getenv('PORT', '8003')}"
workers = int(os.getenv("WEB_CONCURRENCY", "4"))
worker_class = "uvicorn.workers.UvicornWorker"
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
