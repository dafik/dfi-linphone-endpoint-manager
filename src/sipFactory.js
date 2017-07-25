"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Linphone = require("local-dfi-linphone/src/linphone");
const local_dfi_debug_logger_1 = require("local-dfi-debug-logger");
const logger = new local_dfi_debug_logger_1.default("sip:factory");
const AST_ACTION = {
    COMMAND: "Command"
};
function createSipEndpoints(manager, server, host, transport, howMany, asteriskContext, callBackFn, callbackContext) {
    if (!server.managers.peer.enabled) {
        callBackFn.call(callbackContext, new Error("peer manager not enabled"));
        return;
    }
    let endpointsToReturn;
    const foundEndpoints = {};
    let waitForEndpoint = 0;
    logger.debug("sending ast: sip show users");
    server.sendAction({ Action: AST_ACTION.COMMAND, Command: "sip show users" }, onSipShowUsers.bind(this));
    function onSipShowUsers(err, response) {
        logger.debug("ast: sip show users response");
        if (err) {
            throw err;
        }
        let endpoint;
        endpointsToReturn = server.managers.peer.peers.getPeersByTech("SIP");
        let match;
        const foundEndpointsTmp = [];
        const lines = response.$content.split("\n");
        lines.shift();
        lines.forEach((line) => {
            match = line.split(/\s+/);
            if (asteriskContext && asteriskContext === match[2]) {
                if (endpointsToReturn.has(match[0])) {
                    endpoint = endpointsToReturn.get(match[0]);
                    endpoint.password = match[1];
                    endpoint.context = match[2];
                    foundEndpointsTmp[endpoint.objectName] = endpoint;
                }
            }
        });
        if (howMany > foundEndpointsTmp.length) {
            throw new Error("requested phone was: " + howMany + " but match configuration found is: " + foundEndpointsTmp.length);
        }
        waitForEndpoint = Object.keys(foundEndpointsTmp).length;
        for (let i = 0; i < waitForEndpoint; i++) {
            endpoint = foundEndpointsTmp[Object.keys(foundEndpointsTmp)[i]];
            logger.debug("sending ast: sip show peer " + endpoint.objectName);
            server.sendAction({ Action: AST_ACTION.COMMAND, Command: "sip show peer " + endpoint.objectName }, onSipShowPeer.bind(this));
        }
        function onSipShowPeer(err1, resp) {
            logger.debug("response ast: sip show peer " + endpoint.objectName);
            if (err1) {
                throw err1;
            }
            function onCreateError(err2) {
                for (const endpointName in endpointsToReturn) {
                    if (endpointsToReturn.hasOwnProperty(endpointName)) {
                        endpointsToReturn[endpointName].removeListener(Linphone.events.ERROR, onCreateError);
                    }
                }
                callBackFn.call(callbackContext, err2);
            }
            waitForEndpoint--;
            const result = resp.$content.split("\n");
            let name;
            result.forEach((line) => {
                if (-1 !== line.indexOf("* Name")) {
                    const parts = line.split(":");
                    name = parts[1].trim();
                }
                if (-1 !== line.indexOf("Allowed.Trsp")) {
                    const transports = line.replace("Allowed.Trsp :", "").trim().split(",");
                    if (-1 !== transports.indexOf(transport.toUpperCase())) {
                        endpoint = foundEndpointsTmp[name];
                        foundEndpoints[endpoint.objectName] = endpoint;
                    }
                }
            });
            if (waitForEndpoint === 0) {
                const endpointsReturn = {};
                let linphone;
                let pjSipConf;
                const pjSips = Object.keys(foundEndpoints);
                let waitForCreate = howMany;
                for (let i = 0; i < howMany; i++) {
                    pjSipConf = foundEndpoints[pjSips[i]];
                    linphone = new Linphone({
                        host,
                        password: pjSipConf.password,
                        port: manager.currentPort,
                        rtpPort: manager.currentRtpPort,
                        sip: pjSipConf.objectName,
                        technology: "SIP"
                    });
                    linphone.once(Linphone.events.REGISTERED, () => {
                        waitForCreate--;
                        if (waitForCreate === 0) {
                            callBackFn.call(callbackContext, null, endpointsReturn);
                        }
                    });
                    linphone.on(Linphone.events.ERROR, onCreateError);
                    endpointsReturn[pjSips[i]] = linphone;
                }
            }
        }
    }
}
exports.createSipEndpoints = createSipEndpoints;
//# sourceMappingURL=sipFactory.js.map