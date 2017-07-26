"use strict";
const events_1 = require("events");
const pjsipFactory_1 = require("./pjsipFactory");
const sipFactory_1 = require("./sipFactory");
const Linphone = require("local-dfi-linphone/src/linphone");
const _currentPort = (() => {
    let nextId = 5061;
    return () => {
        return nextId++;
    };
})();
const _currentRtpPort = (() => {
    let nextId = 7078;
    return () => {
        return ++nextId;
    };
})();
class EndpointManager extends events_1.EventEmitter {
    static get events() {
        return EVENTS;
    }
    static get _supportedTechnologies() {
        return ["sip", "pjsip"];
    }
    constructor(server) {
        super();
        this._endpoints = new Map();
        this._server = server;
    }
    static get currentPort() {
        return _currentPort();
    }
    static get currentRtpPort() {
        return _currentRtpPort();
    }
    get endpoints() {
        return this._endpoints;
    }
    setEndpoints(endpoints) {
        if (Array.isArray(endpoints)) {
            endpoints.forEach((endpoint) => {
                this.addEndpoint(endpoint);
            });
        }
        else if (!(endpoints instanceof Linphone)) {
            for (const endpointName in endpoints) {
                if (endpoints.hasOwnProperty(endpointName)) {
                    this.addEndpoint(endpoints[endpointName]);
                }
            }
        }
        else {
            this.addEndpoint(endpoints);
        }
    }
    addEndpoint(endpoint) {
        if (!(endpoint instanceof Linphone)) {
            throw new TypeError("endpoint must be Linphone prototype but found: " + typeof endpoint === "Object" ? (endpoint.constructor.name) : " ");
        }
        endpoint.on(Linphone.events.CLOSE, () => {
            if (this._endpoints.has(endpoint.configuration.sip)) {
                this._endpoints.delete(endpoint.configuration.sip);
                if (this._endpoints.size === 0) {
                    process.nextTick(() => {
                        this.emit(EndpointManager.events.ENDPOINTS_CLEARED);
                    });
                }
            }
        });
        this._endpoints.set(endpoint.configuration.sip, endpoint);
    }
    setupEndpoints(howMany, host, transport, technology, context) {
        function onCreated(err, endpoints) {
            if (err) {
                this.emit(EndpointManager.events.ERROR, err);
                return;
            }
            this.setEndpoints(endpoints);
            this.emit(EndpointManager.events.ENDPOINTS_SET, technologyChosen);
        }
        howMany = howMany || 2;
        transport = transport || "udp";
        let technologyChosen;
        this._chooseTechnology(technology, (tech) => {
            technologyChosen = tech;
            if (tech === "pjsip") {
                pjsipFactory_1.createPjsipEndpoints(this, this._server, host, transport, howMany, context, onCreated, this);
            }
            else if (tech === "sip") {
                sipFactory_1.createSipEndpoints(this, this._server, host, transport, howMany, context, onCreated, this);
            }
            else {
                throw new TypeError(tech + "technology not supported yet");
            }
        }, this);
    }
    clear(callback, thisp) {
        let waitForExit = 0;
        function finish() {
            waitForExit--;
            if (waitForExit === 0) {
                if (typeof callback === "function") {
                    callback.call(thisp);
                }
            }
        }
        function onEachEndpoint(endpoint) {
            endpoint.on(Linphone.events.CLOSE, onEndpointExit);
            endpoint.exit();
        }
        function onEndpointExit(endpoint) {
            endpoint.removeListener(Linphone.events.CLOSE, onEndpointExit);
            finish();
        }
        if (this._endpoints.size > 0) {
            waitForExit = this._endpoints.size;
            this._endpoints.forEach(onEachEndpoint);
        }
        else {
            waitForExit = 1;
            finish();
        }
    }
    _chooseTechnology(technology, callback, context) {
        let available = [];
        Object.keys(this._server.managers.channel.technologyCount).forEach((name) => {
            available.push(name.toLowerCase());
        });
        const tmp = [];
        available.forEach((name) => {
            if (-1 !== EndpointManager._supportedTechnologies.indexOf(name.toLowerCase())) {
                tmp.push(name);
            }
        });
        available = tmp;
        if (-1 !== available.indexOf(technology.toLowerCase())) {
            callback.call(context, technology.toLowerCase());
        }
        else {
            callback.call(context, available[0]);
        }
    }
}
const EVENTS = {
    ENDPOINTS_CLEARED: Symbol("endpointsCleared"),
    ENDPOINTS_SET: Symbol("endpointsSet"),
    ERROR: Symbol("error")
};
module.exports = EndpointManager;
//# sourceMappingURL=endpointManager.js.map