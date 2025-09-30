from flask import Flask, send_from_directory, jsonify, render_template
import time
import webbrowser
import threading
import os

app = Flask(__name__)

# Serve the main page
@app.route('/')
def index():
    return render_template('index.html')

# Serve static files
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# API endpoint example (you can expand this)
@app.route('/api/health')
def health_check():
    return jsonify({'status': 'healthy', 'time': time.time()})

def open_browser():
    # Give the server a moment to start
    time.sleep(1.5)
    # Only open browser if this is the main process (not the reloader)
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        webbrowser.open('http://127.0.0.1:5000')

if __name__ == "__main__":
    # Create necessary directories if they don't exist
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    try:
        # Only start the browser if not in debug mode or if this is the main process
        if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
            # Start the browser in a separate thread
            threading.Thread(target=open_browser, daemon=True).start()
        
        # Run the Flask app
        app.run(debug=True, use_reloader=True, use_debugger=True, threaded=True)
    except Exception as e:
        print(f"Error starting server: {e}")
        raise
