# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose the default port (Render sets this via the PORT environment variable)
EXPOSE 10000

# Run the application with gunicorn binding to PORT (or fallback to 10000)
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-10000} --chdir backend app:app"]
