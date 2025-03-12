# Use the official Python image from the Docker Hub
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Define build argument to receive the secret
ARG EXTERNAL_SECRET
# Verify secret was received (with a simpler approach)

echo "EXTERNAL_SECRET: $EXTERNAL_SECRET"
RUN if [ -n "$EXTERNAL_SECRET" ]; then \
        echo "Secret successfully received! Length: $(echo $EXTERNAL_SECRET | wc -c) chars"; \
    else \
        echo "WARNING: No secret received"; \
    fi

# Copy the requirements file into the container
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Define the command to run the application
CMD ["python3", "src/app.py"]
