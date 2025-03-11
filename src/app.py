from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route('/echo', methods=['POST'])
def echo():
    data = request.json
    return jsonify(data), 200

# Write a api function to check db connection health later
@app.route('/db_health', methods=['GET'])
def db_health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)