import os
import time
import json
import base64
import threading
import socketio
import pyautogui
import mss
from PIL import Image
from io import BytesIO
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

import tkinter as tk
from tkinter import messagebox

load_dotenv()

# Configuration
# For production, set VITE_API_URL in .env to your signaling server address
# Configuration

SERVER_URL = "https://connect-pupt.onrender.com"
SSL_VERIFY = False
AGENT_ID = f"AGENT-{os.urandom(4).hex().upper()}"
LOCAL_PORT = 5701

# State
sio = socketio.Client(ssl_verify=SSL_VERIFY)
app = Flask(__name__)
CORS(app)

class AgentState:
    def __init__(self):
        self.is_controlled = False
        self.meeting_id = None
        self.participant_id = None
        self.host_id = None
        self.host_name = None
        self.last_mouse_move = 0.0
        self.is_approved = False

state = AgentState()

MOUSE_THROTTLE_MS = 0.033 # ~30 FPS

# --- Screen Capture & Streaming ---
def stream_screen():
    with mss.mss() as sct:
        while True:
            if state.is_controlled and state.host_id and state.is_approved and sio.connected:
                try:
                    # Capture primary monitor
                    monitor = sct.monitors[1]
                    sct_img = sct.grab(monitor)
                    
                    # Convert to PIL Image
                    img = Image.frombytes('RGB', sct_img.size, sct_img.bgra, 'raw', 'BGRX')
                    
                    # LAG REDUCTION: Lower resolution and better compression
                    img.thumbnail((1024, 576))
                    
                    # Compress to JPEG with optimization
                    buffer = BytesIO()
                    img.save(buffer, format="JPEG", quality=50, optimize=True)
                    base64_frame = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    # Emit frame
                    sio.emit('agent_frame', {
                        'hostId': state.host_id,
                        'frame': f"data:image/jpeg;base64,{base64_frame}"
                    })
                except Exception as e:
                    print(f"Streaming error: {e}")
            
            time.sleep(0.1) # ~10 FPS for drastic CPU reduction

# --- Input Simulation ---
def handle_input_event(data):
    if not state.is_controlled or not state.is_approved:
        return

    try:
        etype = data.get('type')
        x = data.get('x', 0)
        y = data.get('y', 0)
        button = data.get('button', 'left')
        key = data.get('key')
        
        screen_w, screen_h = pyautogui.size()

        if etype == 'mouse_move':
            now = time.time()
            if now - state.last_mouse_move > MOUSE_THROTTLE_MS:
                # OPTIMIZATION: int() and duration=0
                pyautogui.moveTo(int(x * screen_w), int(y * screen_h), duration=0)
                state.last_mouse_move = now
        
        elif etype == 'mouse_click':
            btn = 'left' if button == 'left' else 'right' if button == 'right' else 'middle'
            clicks = 2 if data.get('double') else 1
            pyautogui.click(button=btn, clicks=clicks, _pause=False)
            
        elif etype in ['key_down', 'key_press', 'key_up']:
            if key:
                try:
                    pyautogui.press(key, _pause=False)
                except Exception as ke:
                    print(f"Key simulation error: {ke}")
                    
    except Exception as e:
        print(f"Input execution error: {e}")

# --- Heartbeat ---
def heartbeat():
    while True:
        if sio.connected:
            try:
                sio.emit('agent_heartbeat', {'agentId': AGENT_ID})
            except:
                pass
        time.sleep(10)

# --- Socket.IO Events ---
@sio.event
def connect():
    print("Connected to signaling server")
    sio.emit('agent_connected', {'agentId': AGENT_ID})
    if state.meeting_id and state.participant_id:
        register_agent()

@sio.event
def disconnect():
    print("Disconnected from server")

@sio.on('control_request')
def on_control_request(data):
    host_id = data.get('hostId')
    host_name = data.get('hostName', 'Someone')
    print(f"Control requested by {host_name} ({host_id})")
    print("Waiting for user approval...")
    
    state.host_id = host_id
    state.host_name = host_name
    # Mark as requested but NOT yet controlled until approved/started
    state.is_controlled = False 
    state.is_approved = False

    
    def _popup():
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        # Center the invisible root window
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x = (screen_width // 2) - 150
        y = (screen_height // 2) - 100
        root.geometry(f"300x200+{x}+{y}")
        
        result = messagebox.askyesno(
            "Remote Control Request",
            f"Host '{host_name}' wants to take control of your system.\n\nDo you want to accept?",
            parent=root
        )
        root.destroy()
        
        if result:
            print(f"User APPROVED control for {host_name}")
            state.is_approved = True
            try:
                # We emit to participant browser or directly to backend? 
                # User said: Participant browser emits control_accepted.
                # So the agent just needs to update its internal state.
                sio.emit('control_accepted', {'hostId': host_id, 'agentId': AGENT_ID})
            except Exception as e:
                print(f"Error emitting control_accepted: {e}")
        else:
            print(f"User REJECTED control for {host_name}")
            state.is_controlled = False
            state.is_approved = False
            state.host_id = None
            try:
                sio.emit('control_rejected', {'hostId': host_id, 'agentId': AGENT_ID})
            except Exception as e:
                print(f"Error emitting control_rejected: {e}")

    # threading.Thread(target=_popup, daemon=True).start()


@sio.on('start_remote_control')
def on_start_remote_control(data):
    host_id = data.get('hostId')
    print(f"Remote control STARTED by host: {host_id}")
    state.host_id = host_id
    state.is_controlled = True
    state.is_approved = True # Browser-level approval is sufficient
    
    # Notify backend we are ready (optional but good for logging)
    sio.emit('agent_ready', {'agentId': AGENT_ID, 'hostId': host_id})



@sio.on('stop_control')
@sio.on('force_stop')
def on_stop_control(data=None):
    print("Stopping control (Manual or Force Stop)")
    state.is_controlled = False
    state.is_approved = False
    state.host_id = None

@sio.on('remote_input')
def on_remote_input(data):
    input_event = data.get('event') if data and isinstance(data, dict) and 'event' in data else data
    if input_event:
        print(f"[AGENT] Received remote_input: {input_event.get('type')}")
        handle_input_event(input_event)

def register_agent():
    if sio.connected:
        reg_data = {
            'agentId': AGENT_ID,
            'name': 'Python Agent',
            'meetingId': state.meeting_id,
            'participantId': state.participant_id
        }
        sio.emit('agent_register', reg_data)
        print(f"Registered agent: {AGENT_ID}")

# --- Local Linking & Approval Server ---
@app.route('/status', methods=['GET'])
def get_status():
    is_pending = state.host_id is not None and not state.is_approved
    print(f"Status check: linked={state.meeting_id is not None}, pending={is_pending}, controlled={state.is_controlled}")
    return jsonify({
        'status': 'running',
        'agentId': AGENT_ID,
        'linked': state.meeting_id is not None,
        'isApproved': state.is_approved,
        'pendingRequest': is_pending,
        'hostName': state.host_name
    })

@app.route('/link', methods=['POST'])
def link_session():
    data = request.json
    state.meeting_id = data.get('meetingId')
    state.participant_id = data.get('participantId')
    print(f"Linked to session: {state.meeting_id}")
    register_agent()
    return jsonify({'success': True})

@app.route('/approve', methods=['POST'])
def approve_control():
    if state.is_controlled:
        state.is_approved = True
        print(f"Control APPROVED for {state.host_name}")
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'No pending request'})

@app.route('/reject', methods=['POST'])
def reject_control():
    print(f"Control REJECTED for {state.host_name}")
    on_stop_control()
    return jsonify({'success': True})

def run_flask():
    from waitress import serve
    print(f"Starting Waitress production server on port {LOCAL_PORT}...")
    serve(app, host='127.0.0.1', port=LOCAL_PORT)

# --- Main ---
if __name__ == '__main__':
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0
    
    # Start background threads
    threading.Thread(target=run_flask, daemon=True).start()
    threading.Thread(target=stream_screen, daemon=True).start()
    threading.Thread(target=heartbeat, daemon=True).start()
    
    print(f"Starting production agent {AGENT_ID}...")
    
    # Improved Reconnection Logic
    while True:
        try:
            if not sio.connected:
                sio.connect(
                    SERVER_URL,
                    wait_timeout=10,
                    transports=['websocket']
                )
            sio.wait()
        except Exception as e:
            print(f"Connection error: {e}. Retrying in 3s...")
            time.sleep(3)
