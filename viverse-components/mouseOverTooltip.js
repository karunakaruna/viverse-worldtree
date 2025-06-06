var MouseOverTooltip = pc.createScript('mouseOverTooltip');

MouseOverTooltip.attributes.add('title', {
    type: 'string',
    default: 'Title',
    title: 'Tooltip Title'
});

MouseOverTooltip.attributes.add('description', {
    type: 'string',
    default: '',
    title: 'Tooltip Description'
});

MouseOverTooltip.prototype.initialize = function () {
    this.tooltip = document.createElement('div');
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.background = 'rgba(0, 0, 0, 0.75)';
    this.tooltip.style.color = '#fff';
    this.tooltip.style.padding = '6px 10px';
    this.tooltip.style.borderRadius = '4px';
    this.tooltip.style.fontSize = '13px';
    this.tooltip.style.display = 'none';
    this.tooltip.style.pointerEvents = 'none';
    this.tooltip.style.zIndex = 9999;
    document.body.appendChild(this.tooltip);

    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.hideTooltip, this);
};

MouseOverTooltip.prototype.onMouseMove = function (event) {
    const camera = this.app.root.findByName("Camera");
    if (!camera || !camera.camera) return;

    const from = camera.camera.screenToWorld(event.x, event.y, camera.camera.nearClip);
    const to = camera.camera.screenToWorld(event.x, event.y, camera.camera.farClip);
    const result = this.app.systems.rigidbody.raycastFirst(from, to);

    if (result && result.entity === this.entity) {
        this.tooltip.style.left = (event.x + 12) + 'px';
        this.tooltip.style.top = (event.y + 12) + 'px';
        this.tooltip.innerHTML = `<strong>${this.title}</strong><br>${this.description}`;
        this.tooltip.style.display = 'block';
    } else {
        this.tooltip.style.display = 'none';
    }
};

MouseOverTooltip.prototype.hideTooltip = function () {
    this.tooltip.style.display = 'none';
};

MouseOverTooltip.prototype.onDestroy = function () {
    if (this.tooltip && this.tooltip.parentNode) {
        this.tooltip.parentNode.removeChild(this.tooltip);
    }
    this.app.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.hideTooltip, this);
};
