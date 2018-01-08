"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dfi_debug_logger_1 = require("dfi-debug-logger");
const dfi_linphone_1 = require("dfi-linphone");
const endpointManager_1 = require("./endpointManager");
const logger = new dfi_debug_logger_1.default("sip:factory");
const AST_ACTION = {
    COMMAND: "Command"
};
function createSipEndpoints(manager, server, host, transport, howMany, asteriskContext, callBackFn, callbackContext) {
    if (!server.managers.peer.enabled) {
        callBackFn.call(callbackContext, new Error("peer manager not enabled"));
        return;
    }
    let endpointsToReturn;
    logger.debug("sending ast: sip show users");
    server.sendAction({ Action: AST_ACTION.COMMAND, Command: "sip show users" }, onSipShowUsers.bind(this));
    function onCreateError(err2) {
        for (const endpointName in endpointsToReturn) {
            if (endpointsToReturn.hasOwnProperty(endpointName)) {
                endpointsToReturn[endpointName].removeListener(dfi_linphone_1.default.events.ERROR, onCreateError);
            }
        }
        callBackFn.call(callbackContext, err2);
    }
    function createLinphones(foundEndpoints) {
        const endpointsReturn = {};
        let linphone;
        let pjSipConf;
        const pjSips = Array.from(foundEndpoints.keys());
        let waitForCreate = howMany;
        for (let i = 0; i < howMany; i++) {
            pjSipConf = foundEndpoints.get(pjSips[i]);
            linphone = new dfi_linphone_1.default({
                host,
                password: pjSipConf.password,
                port: endpointManager_1.default.currentPort,
                rtpPort: endpointManager_1.default.currentRtpPort,
                sip: pjSipConf.objectName,
                technology: "SIP"
            });
            linphone.once(dfi_linphone_1.default.events.REGISTERED, () => {
                waitForCreate--;
                if (waitForCreate === 0) {
                    callBackFn.call(callbackContext, null, endpointsReturn);
                }
            });
            linphone.on(dfi_linphone_1.default.events.ERROR, onCreateError);
            endpointsReturn[pjSips[i]] = linphone;
        }
    }
    function checkTransport(foundEndpointsTmp) {
        const foundEndpoints = new Map();
        const waitForEndpoint = new Set(foundEndpointsTmp.keys());
        foundEndpointsTmp.forEach((endpoint1) => {
            logger.debug("sending ast: sip show peer " + endpoint1.objectName);
            server.sendEventGeneratingAction({ Action: AST_ACTION.COMMAND, Command: "sip show peer " + endpoint1.objectName }, onSipShowPeer.bind(this));
        });
        function onSipShowPeer(err1, resp) {
            if (err1) {
                throw err1;
            }
            const result = resp.$content.split("\n");
            let name;
            let found = false;
            result.forEach((line) => {
                if (-1 !== line.indexOf("* Name")) {
                    const parts = line.split(":");
                    name = parts[1].trim();
                    logger.debug("response ast: sip show peer " + name);
                }
                if (-1 !== line.indexOf("Allowed.Trsp")) {
                    const transports = line.replace("Allowed.Trsp :", "").trim().split(",");
                    if (-1 !== transports.indexOf(transport.toUpperCase())) {
                        found = true;
                    }
                }
            });
            if (found) {
                const endpoint = foundEndpointsTmp.get(name);
                foundEndpoints.set(endpoint.objectName, endpoint);
            }
            waitForEndpoint.delete(name);
            if (waitForEndpoint.size === 0) {
                createLinphones(foundEndpoints);
            }
        }
    }
    function onSipShowUsers(err, response) {
        logger.debug("ast: sip show users response");
        if (err) {
            throw err;
        }
        endpointsToReturn = server.managers.peer.peers.getPeersByTech("SIP");
        const foundEndpoints = new Map();
        let match;
        const foundEndpointsTmp = new Map();
        const lines = response.$content.split("\n");
        lines.shift();
        lines.forEach((line) => {
            match = line.split(/\s+/);
            if (asteriskContext && asteriskContext === match[2]) {
                if (endpointsToReturn.has(match[0])) {
                    const endpoint = endpointsToReturn.get(match[0]);
                    endpoint.password = match[1];
                    endpoint.context = match[2];
                    foundEndpointsTmp.set(endpoint.objectName, endpoint);
                }
            }
        });
        if (howMany > foundEndpointsTmp.size) {
            throw new Error("requested phone was: " + howMany + " but match configuration found is: " + foundEndpointsTmp.size);
        }
        checkTransport(foundEndpointsTmp);
    }
}
exports.createSipEndpoints = createSipEndpoints;
//# sourceMappingURL=sipFactory.js.map