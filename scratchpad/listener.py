#!/usr/bin/env python3
import json, os, socket, sys, threading, time

def start_server():
    runtime = os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}")
    my_sock = os.path.join(runtime, "cc-socks", "antigravity.sock")
    
    if os.path.exists(my_sock):
        os.unlink(my_sock)

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(my_sock)
    server.listen(5)
    print(f"[*] Listening on {my_sock} for replies...")

    while True:
        try:
            conn, _ = server.accept()
            conn.settimeout(2)
            data = b""
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
            
            print("\n[+] Received raw data:")
            print(data.decode("utf-8"))
            conn.close()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            break
        except Exception as e:
            print(f"Error handling connection: {e}")

    server.close()
    if os.path.exists(my_sock):
        os.unlink(my_sock)

def send_message(pid: int, message: str):
    runtime = os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}")
    target_sock = os.path.join(runtime, "cc-socks", f"{pid}.sock")
    my_sock = f"uds:{os.path.join(runtime, 'cc-socks', 'antigravity.sock')}"
    
    if not os.path.exists(target_sock):
        print(f"[-] Target socket {target_sock} does not exist.")
        return

    lines = [{
        "type": "user",
        "from": my_sock,
        "fromName": "Antigravity Listener",
        "message": {"role": "user", "content": message}
    }]
    
    payload = "".join(json.dumps(o) + "\n" for o in lines).encode()
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        s.connect(target_sock)
        s.sendall(payload)
        s.shutdown(socket.SHUT_WR)
    print(f"[*] Sent message to {target_sock}")

if __name__ == "__main__":
    if len(sys.argv) > 2:
        pid = int(sys.argv[1])
        message = sys.argv[2]
        
        # Start server in background thread
        t = threading.Thread(target=start_server, daemon=True)
        t.start()
        
        time.sleep(0.5)
        send_message(pid, message)
        
        print("[*] Waiting for a response (Press Ctrl+C to stop)...")
        while True:
            time.sleep(1)
    else:
        print("Usage: ./listener.py <pid> <message>")
