import flask
from flask import send_file

app = flask.Flask(__name__)

@app.route('/')
def index():
    return send_file('test.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)