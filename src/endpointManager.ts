import {EventEmitter} from "events";
import {createPjsipEndpoints} from "./pjsipFactory";
import {createSipEndpoints} from "./sipFactory";
import Linphone = require("local-dfi-linphone/src/linphone");
import AsteriskServer = require("local-dfi-asterisk/src/asteriskServer");

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

class EndpointManager extends EventEmitter {
    public static get events() {
        return EVENTS;
    }

    private static get _supportedTechnologies(): string[] {
        return ["sip", "pjsip"];
    }

    private _endpoints: Map<number, Linphone>;
    private _server: AsteriskServer;

    constructor(server: AsteriskServer) {
        super();

        this._endpoints = new Map();
        this._server = server;
    }

    public  get currentPort(): number {
        return _currentPort();
    }

    public  get  currentRtpPort(): number {
        return _currentRtpPort();
    }

    get endpoints(): Map<number, Linphone> {
        return this._endpoints;
    }

    public setEndpoints(endpoints: Linphone|Linphone[]|{[key: string]: Linphone}) {
        if (Array.isArray(endpoints)) {
            endpoints.forEach((endpoint) => {

                this.addEndpoint(endpoint);
            });
        } else if (!(endpoints instanceof Linphone)) {
            for (const endpointName in endpoints) {
                if (endpoints.hasOwnProperty(endpointName)) {
                    this.addEndpoint(endpoints[endpointName]);
                }
            }
        } else {
            this.addEndpoint(endpoints);
        }
    }

    public addEndpoint(endpoint: Linphone) {
        if (!(endpoint instanceof Linphone)) {
            throw new TypeError("endpoint must be Linphone prototype but found: " + typeof endpoint === "Object" ? ((endpoint as any).constructor.name) : " ");
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

    public setupEndpoints(howMany, transport, technology, context) {
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
                createPjsipEndpoints(this, this._server, transport, howMany, context, onCreated, this);
            } else if (tech === "sip") {
                createSipEndpoints(this, this._server, transport, howMany, context, onCreated, this);
            } else {
                throw new TypeError(tech + "technology not supported yet");
            }
        }, this);
    }

    public clear(callback?, thisp?) {
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
        } else {
            waitForExit = 1;
            finish();
        }

    }

    private _chooseTechnology(technology, callback, context) {

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
        } else {
            callback.call(context, available[0]);
        }
    }
}

const EVENTS = {
    ENDPOINTS_CLEARED: Symbol("endpointsCleared"),
    ENDPOINTS_SET: Symbol("endpointsSet"),
    ERROR: Symbol("error")
};

export = EndpointManager;
