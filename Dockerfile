# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ .
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config/ config/
COPY src/ src/
COPY server/ server/
COPY data/ data/
COPY output/ output/
COPY main.py .

# Copy built frontend
COPY --from=frontend-build /app/web/dist /app/static

ENV PORT=8000
EXPOSE 8000

CMD uvicorn server.app:app --host 0.0.0.0 --port $PORT
