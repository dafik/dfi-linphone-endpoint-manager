"use strict";
const Linphone = require("local-dfi-linphone/src/linphone");
const AST_ACTION = {
    PJSIP_SHOW_ENDPOINT: "PJSIPShowEndpoint"
};
function createPjsipEndpoints(manager, server, transport, howMany, astContext, callBackFn, callbackContext) {
    let endpoints = {};
    let foundEndpoints = {};
    let waitForEndpoint = 0;
    let waitForCreate = 0;
    server.sendEventGeneratingAction({ Action: AST_ACTION.PJSIP_SHOW_ENDPOINTS }, (err, response) => {
        if (err) {
            callBackFn.call(callbackContext, err);
            return;
        }
        response.events.forEach((endpoint) => {
            if (endpoint.Transport === "transport-udp") {
                foundEndpoints[endpoint.objectName] = endpoint;
            }
        });
        for (let name in foundEndpoints) {
            if (foundEndpoints.hasOwnProperty(name)) {
                waitForEndpoint++;
                let act = { Action: AST_ACTION.PJSIP_SHOW_ENDPOINT, Endpoint: name };
                server.sendEventGeneratingAction(act, (err1, response1) => {
                    if (err1) {
                        callBackFn.call(callbackContext, err1);
                        return;
                    }
                    waitForEndpoint--;
                    response1.events.forEach(cr => {
                        if (cr.Event === "AuthDetail") {
                            foundEndpoints[cr.objectName].password = cr.password;
                            if (waitForEndpoint === 0) {
                                ready.call(this);
                            }
                        }
                    });
                });
            }
        }
        function ready() {
            let linphone;
            let pjSipConf;
            let pjSips = Object.keys(foundEndpoints);
            for (let i = 0; i < howMany; i++) {
                waitForCreate++;
                pjSipConf = foundEndpoints[pjSips[i]];
                linphone = new Linphone({
                    host: server.getProp("options").server.host,
                    password: pjSipConf.password,
                    port: manager.currentPort,
                    rtpPort: manager.currentRtpPort,
                    sip: pjSipConf.objectname,
                    technology: "PJSIP"
                });
                linphone.once(Linphone.events.REGISTERED, onCreateClient.bind(this));
                linphone.on(Linphone.events.ERROR, onCreateError.bind(this));
                endpoints[pjSips[i]] = linphone;
            }
        }
        function onCreateClient() {
            waitForCreate--;
            if (waitForCreate === 0) {
                callBackFn.call(callbackContext, null, endpoints);
            }
        }
        function onCreateError(err1) {
            for (let endpointName in endpoints) {
                if (endpoints.hasOwnProperty(endpointName)) {
                    endpoints[endpointName].removeListener(Linphone.events.ERROR, onCreateError);
                }
            }
            callBackFn.call(callbackContext, err1);
        }
    });
}
exports.createPjsipEndpoints = createPjsipEndpoints;
//# sourceMappingURL=pjsipFactory.js.map