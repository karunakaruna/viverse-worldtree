var Ws = pc.createScript('ws');

// === CONFIG ATTRIBUTES =====================================

Ws.attributes.add('targetUserId', {
    type: 'string',
    default: '',
    title: 'Target User ID'
});

Ws.attributes.add('scaleWithHeartbeat', {
    type: 'boolean',
    default: true,
    title: 'Scale With Heartbeat'
});

Ws.attributes.add('presetHost', {
    type: 'string',
    enum: [
        { 'WorldTree': 'wss://worldtree.online' },
        { 'Localhost': 'wss://localhost' }
    ],
    default: 'wss://worldtree.online',
    title: 'Preset Host'
});

Ws.attributes.add('customHost', {
    type: 'string',
    default: '',
    title: 'Custom Host (Overrides Preset)'
});

Ws.attributes.add('presetPort', {
    type: 'string',
    enum: [
        { 'Port 3001': '3001' },
        { 'Port 443': '443' }
    ],
    default: '3001',
    title: 'Preset Port'
});

Ws.attributes.add('customPort', {
    type: 'string',
    default: '',
    title: 'Custom Port (Overrides Preset)'
});

// === INITIALIZATION ========================================

Ws.prototype.initialize = function () {
    this.socket = null;
    this.connected = false;
    this.userId = null;

    this.pingEffectTime = 0;
    this.pingScaleTime = 0;
    this.originalScale = this.entity.getLocalScale().clone();

    this.lastReceivedData = null;

    this.pingMaterial = this.entity.model?.material?.clone();
    if (this.pingMaterial) {
        this.entity.model.material = this.pingMaterial;
    } else {
        console.warn("No material found on entity. Ensure it has a Model Component with a material.");
    }

    this.createMouseLabel();
    this.createDebugOverlay();
    this.createSendOverlay();
    this.findTextElement();

    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);

    this.activeCamera = null;
    this.app.on("activeCameraManagerReady", (acm) => {
        this.activeCamera = acm.activeCamera;
        acm.onCameraChange((newCam) => {
            this.activeCamera = newCam;
        });
    });

    this.connectWebSocket();
};

// === CONNECTION ============================================

Ws.prototype.getServerUrl = function () {
    const host = this.customHost.trim() || this.presetHost;
    const port = this.customPort.trim() || this.presetPort;
    return `${host}:${port}`;
};

Ws.prototype.connectWebSocket = function () {
    const serverUrl = this.getServerUrl();
    console.log('Connecting to WebSocket:', serverUrl);
    this.socket = new WebSocket(serverUrl);

    this.socket.addEventListener('open', this.onOpen.bind(this));
    this.socket.addEventListener('message', this.onMessage.bind(this));
    this.socket.addEventListener('error', this.onError.bind(this));
    this.socket.addEventListener('close', this.onClose.bind(this));
};

Ws.prototype.findTextElement = function () {
    const taggedEntities = this.app.root.findByTag('heartbeatText');

    for (let i = 0; i < taggedEntities.length; i++) {
        const e = taggedEntities[i];
        if (e.element && e.element.type === 'text') {
            console.log('[WS] Found global text element with tag "heartbeatText":', e.name);
            this.textElement = e.element;
            return;
        }
    }

    console.warn('[WS] No globally tagged text element with tag "heartbeatText" found.');
    this.textElement = null;
};



Ws.prototype.onOpen = function () {
    this.connected = true;
    const reconnectMessage = {
        type: "reconnect",
        secret: this.getStoredSecret()
    };
    this.socket.send(JSON.stringify(reconnectMessage));
};

Ws.prototype.onMessage = function (event) {
    try {
        const message = JSON.parse(event.data);
        switch (message.type) {
            case "welcome":
                this.userId = message.id;
                this.updateListeningTo();
                this.updateDebugOverlay();
                break;
            case "ping":
                this.handlePing(message);
                break;
            case "data":
                if (message.from === this.targetUserId && message.data) {
                    this.lastReceivedData = message.data;
                    this.updateHoverLabel();
                }
                break;
        }
    } catch (error) {
        console.error('Error parsing message:', error);
    }
};

Ws.prototype.onError = function (error) {
    console.error('WebSocket error:', error);
};

Ws.prototype.onClose = function () {
    this.connected = false;
    setTimeout(() => this.connectWebSocket(), 5000);
};

// === CAMERA + INTERACTIONS ================================

Ws.prototype.getActiveCamera = function () {
    return this.activeCamera || this.app.root.findByName("Camera");
};

Ws.prototype.onMouseMove = function (event) {
    const cameraEntity = this.getActiveCamera();
    if (!cameraEntity || !cameraEntity.camera) return;

    const from = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.nearClip);
    const to = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.farClip);
    const result = this.app.systems.rigidbody.raycastFirst(from, to);

    if (result && result.entity === this.entity) {
        this.label.style.left = `${event.x + 10}px`;
        this.label.style.top = `${event.y + 10}px`;
        this.label.style.display = 'block';
    } else {
        this.label.style.display = 'none';
    }
};

Ws.prototype.onMouseDown = function (event) {
    const cameraEntity = this.getActiveCamera();
    if (!cameraEntity || !cameraEntity.camera) return;

    const from = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.nearClip);
    const to   = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.farClip);
    const hit  = this.app.systems.rigidbody.raycastFirst(from, to);

    // Only fire when the click actually hits this entity and the socket is live
    if (hit && hit.entity === this.entity && this.connected) {
        const payload = {
            type: "chat",                            // ← new route
            text: "Hello from PlayCanvas/Viverse",   // or `message:` if you prefer
            timestamp: Date.now()
        };

        this.socket.send(JSON.stringify(payload));
        this.appendSendMessage(payload);  // keep your local log helper
    }
};


// === UI OVERLAYS ==========================================

Ws.prototype.createMouseLabel = function () {
    this.label = document.createElement('div');
    this.label.style.position = 'absolute';
    this.label.style.backgroundColor = 'rgba(0,0,0,0.6)';
    this.label.style.color = 'white';
    this.label.style.padding = '4px 6px';
    this.label.style.fontSize = '12px';
    this.label.style.borderRadius = '4px';
    this.label.style.pointerEvents = 'none';
    this.label.style.display = 'none';
    this.label.innerText = 'Hovered!';
    document.body.appendChild(this.label);
};

Ws.prototype.createDebugOverlay = function () {
    this.debugInfo = document.createElement('div');
    this.debugInfo.style.position = 'absolute';
    this.debugInfo.style.top = '10px';
    this.debugInfo.style.left = '10px';
    this.debugInfo.style.backgroundColor = 'rgba(0,0,0,0.7)';
    this.debugInfo.style.color = 'white';
    this.debugInfo.style.padding = '8px';
    this.debugInfo.style.fontSize = '13px';
    this.debugInfo.style.borderRadius = '6px';
    this.debugInfo.style.zIndex = '999';
    this.debugInfo.innerText = 'Initializing...';
    document.body.appendChild(this.debugInfo);
};

Ws.prototype.createSendOverlay = function () {
    this.sendInfo = document.createElement('div');
    this.sendInfo.style.position = 'absolute';
    this.sendInfo.style.top = '10px';
    this.sendInfo.style.right = '10px';
    this.sendInfo.style.backgroundColor = 'rgba(0,0,0,0.7)';
    this.sendInfo.style.color = 'white';
    this.sendInfo.style.padding = '8px';
    this.sendInfo.style.fontSize = '13px';
    this.sendInfo.style.borderRadius = '6px';
    this.sendInfo.style.zIndex = '999';
    this.sendInfo.innerText = 'Send Debug:';
    document.body.appendChild(this.sendInfo);
};

Ws.prototype.appendSendMessage = function (data) {
    const entry = document.createElement('div');
    entry.innerText = `[${new Date().toLocaleTimeString()}] Sent: ${JSON.stringify(data)}`;
    entry.style.fontSize = '11px';
    entry.style.marginBottom = '4px';
    this.sendInfo.appendChild(entry);

    setTimeout(() => {
        if (entry.parentNode) entry.parentNode.removeChild(entry);
    }, 10000);
};

// === LISTENING AND PING ====================================

Ws.prototype.updateDebugOverlay = function () {
    const userId = this.userId || 'N/A';
    const targetId = this.targetUserId || 'N/A';
    this.debugInfo.innerText = `Your UserID: ${userId}\nListening To: ${targetId}`;
};

Ws.prototype.updateHoverLabel = function () {
    if (this.lastReceivedData && typeof this.lastReceivedData === 'object') {
        const preview = Object.entries(this.lastReceivedData)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
        const userLine = `\nSession UUID: ${this.userId || 'N/A'}`;
        this.label.innerText = preview + userLine;
    } else {
        this.label.innerText = `Hovered!\nSession UUID: ${this.userId || 'N/A'}`;
    }
};


Ws.prototype.updateListeningTo = function () {
    if (!this.targetUserId) return;
    const listeningMessage = {
        type: "updatelisteningto",
        newListeningTo: [this.targetUserId]
    };
    this.socket.send(JSON.stringify(listeningMessage));
};

Ws.prototype.handlePing = function (message) {
    this.pingEffectTime = 0.5;
    if (this.scaleWithHeartbeat) {
        this.pingScaleTime = 0.25;
    }

    if (this.textElement) {
        const timestamp = new Date().toLocaleTimeString();
        this.textElement.text = `Ping @ ${timestamp}\nUser: ${this.userId || 'N/A'}`;
    }
};


// === LIFECYCLE =============================================

Ws.prototype.getStoredSecret = function () {
    return null;
};

Ws.prototype.update = function (dt) {
    if (this.pingEffectTime > 0) {
        this.pingEffectTime -= dt;
        if (this.pingMaterial) {
            const intensity = Math.max(0, this.pingEffectTime / 0.5);
            this.pingMaterial.emissive.set(intensity, intensity, intensity);
        }
    } else if (this.pingMaterial) {
        this.pingMaterial.emissive.set(0, 0, 0);
    }

    if (this.pingScaleTime > 0) {
        this.pingScaleTime -= dt;
        const t = Math.sin((1 - this.pingScaleTime / 0.25) * Math.PI);
        const scaleFactor = 1 + 0.1 * t;
        this.entity.setLocalScale(this.originalScale.clone().scale(scaleFactor));
    } else {
        this.entity.setLocalScale(this.originalScale);
    }
};

Ws.prototype.sendMessage = function (text) {
    if (!this.connected || !this.socket) {
        console.warn('Cannot send message: WebSocket not connected');
        return;
    }

    const payload = {
        type: "chat",
        text: text,
        timestamp: Date.now()
    };

    this.socket.send(JSON.stringify(payload));
    this.appendSendMessage(payload);
};

Ws.prototype.onDestroy = function () {
    if (this.socket) {
        this.socket.close();
    }
    if (this.label?.parentNode) this.label.parentNode.removeChild(this.label);
    if (this.debugInfo?.parentNode) this.debugInfo.parentNode.removeChild(this.debugInfo);
    if (this.sendInfo?.parentNode) this.sendInfo.parentNode.removeChild(this.sendInfo);
    this.app.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
};
