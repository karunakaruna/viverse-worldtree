var BodyVisOrig = pc.createScript('bodyVisOrig');

BodyVisOrig.attributes.add('targetUserId', {
    type: 'string',
    default: '',
    title: 'Target User ID'
});

BodyVisOrig.attributes.add('scaleWithHeartbeat', {
    type: 'boolean',
    default: false,
    title: 'Scale With Heartbeat'
});

BodyVisOrig.attributes.add('material', {
    type: 'asset',
    assetType: 'material',
    title: 'Sphere Material'
});

BodyVisOrig.attributes.add('scaleMultiplier', {
    type: 'number',
    default: 1,
    title: 'Position Scale Multiplier'
});

BodyVisOrig.attributes.add('sphereSize', {
    type: 'number',
    default: 0.05,
    title: 'Sphere Size'
});

BodyVisOrig.attributes.add('enableContextMenu', {
    type: 'boolean',
    default: true,
    title: 'Enable Context Menu'
});

BodyVisOrig.prototype.initialize = function () {
    this.serverUrl = "wss://worldtree.onrender.com";
    this.socket = null;
    this.connected = false;
    this.userId = null;

    this.lastReceivedData = {};
    this.newDataReady = false;

    this.bodyParts = [
        'left_eye', 'right_eye', 'nose',
        'left_shoulder', 'right_shoulder',
        'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist',
        'left_hip', 'right_hip',
        'left_knee', 'right_knee',
        'left_ankle', 'right_ankle'
    ];

    this.spheres = {};
    this.bodyParts.forEach(part => {
        const sphere = new pc.Entity();
        sphere.addComponent('model', {
            type: 'sphere'
        });
        sphere.setLocalScale(this.sphereSize, this.sphereSize, this.sphereSize);
        if (this.material && this.material.resource) {
            sphere.model.material = this.material.resource;
        }
        this.entity.addChild(sphere);
        this.spheres[part] = sphere;
    });

    // Add connectors between joints
    this.connectors = {};
    this.connectorPairs = [
        ['left_shoulder', 'left_elbow'],
        ['left_elbow', 'left_wrist'],
        ['right_shoulder', 'right_elbow'],
        ['right_elbow', 'right_wrist'],
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle'],
        ['left_shoulder', 'right_shoulder'],
        ['left_hip', 'right_hip'],
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip']
    ];

    this.connectorPairs.forEach(pair => {
        const connector = new pc.Entity();
        connector.addComponent('model', {
            type: 'box'
        });
        connector.setLocalScale(0.02, 0.02, 0.1); // placeholder scale
        if (this.material && this.material.resource) {
            connector.model.material = this.material.resource;
        }
        this.entity.addChild(connector);
        this.connectors[pair.join('-')] = connector;
    });

    if (this.enableContextMenu) {
        this.createContextMenu();
        this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    }

    this.connectWebSocket();
};

BodyVisOrig.prototype.createContextMenu = function () {
    this.contextMenu = document.createElement('div');
    this.contextMenu.style.position = 'absolute';
    this.contextMenu.style.top = '50px';
    this.contextMenu.style.right = '10px';
    this.contextMenu.style.padding = '10px';
    this.contextMenu.style.background = 'rgba(0,0,0,0.8)';
    this.contextMenu.style.color = '#fff';
    this.contextMenu.style.display = 'none';
    this.contextMenu.style.zIndex = '1000';
    this.contextMenu.style.pointerEvents = 'auto';

    this.inputField = document.createElement('input');
    this.inputField.type = 'text';
    this.inputField.placeholder = 'Enter User ID';
    this.inputField.style.width = '200px';
    this.inputField.style.marginBottom = '10px';
    this.contextMenu.appendChild(this.inputField);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Set Listening To';
    submitButton.onclick = () => {
        this.targetUserId = this.inputField.value;
        this.updateListeningTo();
        this.contextMenu.style.display = 'none';
    };
    this.contextMenu.appendChild(submitButton);

    const close = document.createElement('div');
    close.textContent = '×';
    close.style.position = 'absolute';
    close.style.top = '4px';
    close.style.right = '8px';
    close.style.cursor = 'pointer';
    close.onclick = () => this.contextMenu.style.display = 'none';
    this.contextMenu.appendChild(close);

    document.body.appendChild(this.contextMenu);
};

BodyVisOrig.prototype.onMouseDown = function (event) {
    if (this.enableContextMenu && event.button === 2) {
        event.event.preventDefault();
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.left = `${event.event.clientX}px`;
        this.contextMenu.style.top = `${event.event.clientY}px`;
    }
};

BodyVisOrig.prototype.connectWebSocket = function () {
    console.log('Connecting to WebSocket server:', this.serverUrl);
    this.socket = new WebSocket(this.serverUrl);
    this.socket.addEventListener('open', this.onOpen.bind(this));
    this.socket.addEventListener('message', this.onMessage.bind(this));
    this.socket.addEventListener('error', this.onError.bind(this));
    this.socket.addEventListener('close', this.onClose.bind(this));
};

BodyVisOrig.prototype.onOpen = function () {
    console.log('WebSocket connection opened');
    this.connected = true;
    const reconnectMessage = {
        type: "reconnect",
        secret: this.getStoredSecret()
    };
    console.log('Sending reconnect message:', reconnectMessage);
    this.socket.send(JSON.stringify(reconnectMessage));
};

BodyVisOrig.prototype.onMessage = function (event) {
    try {
        const message = JSON.parse(event.data);

        if (message.type === "welcome") {
            this.userId = message.id;
            console.log('Assigned userId:', this.userId);
            this.updateListeningTo();
        }

        if (message.type === "data" && message.from === this.targetUserId && message.data) {
            this.lastReceivedData = message.data;
            this.newDataReady = true;
        }
    } catch (err) {
        console.error('WebSocket message error:', err);
    }
};

BodyVisOrig.prototype.update = function (dt) {
    if (!this.newDataReady) return;

    for (const part of this.bodyParts) {
        const x = parseFloat(this.lastReceivedData[`${part}:x`]);
        const y = parseFloat(this.lastReceivedData[`${part}:y`]);
        const z = parseFloat(this.lastReceivedData[`${part}:z`]);

        if (!isNaN(x) && !isNaN(y) && !isNaN(z) && x !== 0 && y !== 0 && z !== 0) {
            const localPos = new pc.Vec3(x, y, z).scale(this.scaleMultiplier);
            this.spheres[part].setLocalPosition(localPos);
        }
    }

    // Update limb connectors
    this.connectorPairs.forEach(pair => {
        const [jointA, jointB] = pair;
        const posA = this.spheres[jointA].getPosition();
        const posB = this.spheres[jointB].getPosition();

        const mid = new pc.Vec3().lerp(posA, posB, 0.5);
        const dir = new pc.Vec3().sub2(posB, posA);
        const length = dir.length();

        const connector = this.connectors[pair.join('-')];
        connector.setPosition(mid);
        connector.lookAt(posB);
        connector.setLocalScale(0.02, 0.02, length);
    });

    this.newDataReady = false;
};

BodyVisOrig.prototype.updateListeningTo = function () {
    if (!this.targetUserId) return;
    const listeningMessage = {
        type: "updatelisteningto",
        newListeningTo: [this.targetUserId]
    };
    console.log('Sending listeningTo update:', listeningMessage);
    this.socket.send(JSON.stringify(listeningMessage));
};

BodyVisOrig.prototype.getStoredSecret = function () {
    return null;
};

BodyVisOrig.prototype.onError = function (err) {
    console.error('WebSocket error:', err);
};

BodyVisOrig.prototype.onClose = function () {
    console.warn('WebSocket connection closed. Attempting to reconnect...');
    this.connected = false;
    setTimeout(() => this.connectWebSocket(), 5000);
};

BodyVisOrig.prototype.swap = function (old) {
    if (old.enableContextMenu) {
        this.app.mouse.off(pc.EVENT_MOUSEDOWN, old.onMouseDown, old);
        if (old.contextMenu && old.contextMenu.parentNode) {
            old.contextMenu.parentNode.removeChild(old.contextMenu);
        }
    }
    this.initialize();
};
