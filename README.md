# My Flask App

This is a simple Flask application that demonstrates how to create a web server with two API endpoints.

## Project Structure

```
my-flask-app
├── src
│   ├── app.py
├── requirements.txt
└── README.md
```

## Installation

To install the required packages, run the following command:

```
pip install -r requirements.txt
```

## Running the Application

To run the Flask application, execute the following command:

```
python src/app.py
```

The application will be accessible at `http://localhost:8080`.

## API Endpoints

### Health Check

- **Endpoint:** `/health`
- **Method:** GET
- **Description:** Returns a simple health check response.

### Echo

- **Endpoint:** `/echo`
- **Method:** POST
- **Description:** Returns the message sent in the request body.