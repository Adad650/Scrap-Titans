from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser
import os

def run(server_class=HTTPServer, handler_class=SimpleHTTPRequestHandler, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting server at http://localhost:{port}")
    webbrowser.open(f'http://localhost:{port}')
    httpd.serve_forever()

if __name__ == "__main__":
    # Change to the directory where the script is located
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    run()
