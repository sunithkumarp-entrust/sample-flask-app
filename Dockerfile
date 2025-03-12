# Use the official Python image from the Docker Hub
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Define build argument to receive the secret
ARG EXTERNAL_SECRET
# Verify secret was received (masked in the output for security)
RUN if [ -n "$EXTERNAL_SECRET" ]; then \
        secret_len=${#EXTERNAL_SECRET}; \
        if [ "$secret_len" -gt 2 ]; then \
            masked=$(printf "%0.s*" $(seq 1 $((secret_len-2)))); \
            last_two=${EXTERNAL_SECRET: -2}; \
            echo "Secret successfully received! Value: $masked$last_two"; \
        else \
            echo "Secret successfully received! Value: **"; \
        fi; \
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
