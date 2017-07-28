import Linphone from "local-dfi-linphone";
import EndpointManager from "./endpointManager";
import {IAsteriskServer} from "./interfaces";

const AST_ACTION = {
    PJSIP_SHOW_ENDPOINT: "PJSIPShowEndpoint",
    PJSIP_SHOW_ENDPOINTS: "PJSIPShowEndpoints"
};

export function createPjsipEndpoints(manager: EndpointManager, server: IAsteriskServer, host: string, transport: string, howMany: number, astContext, callBackFn, callbackContext) {

    const endpoints = {};
    const foundEndpoints = {};
    let waitForEndpoint = 0;
    let waitForCreate = 0;

    server.sendEventGeneratingAction({Action: AST_ACTION.PJSIP_SHOW_ENDPOINTS}, (err, response) => {
        if (err) {
            callBackFn.call(callbackContext, err);
            return;
        }

        response.events.forEach((endpoint) => {

            if (endpoint.Transport === "transport-udp") {
                foundEndpoints[endpoint.objectName] = endpoint;
            }
        });
        for (const name in foundEndpoints) {
            if (foundEndpoints.hasOwnProperty(name)) {
                waitForEndpoint++;
                const act = {Action: AST_ACTION.PJSIP_SHOW_ENDPOINT, Endpoint: name};
                server.sendEventGeneratingAction(act, (err1, response1) => {
                    if (err1) {
                        callBackFn.call(callbackContext, err1);
                        return;
                    }
                    waitForEndpoint--;

                    response1.events.forEach((cr) => {
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
            const pjSips = Object.keys(foundEndpoints);
            for (let i = 0; i < howMany; i++) {
                waitForCreate++;
                pjSipConf = foundEndpoints[pjSips[i]];
                linphone = new Linphone({
                    host,
                    password: pjSipConf.password,
                    port: EndpointManager.currentPort,
                    rtpPort: EndpointManager.currentRtpPort,
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
            for (const endpointName in endpoints) {
                if (endpoints.hasOwnProperty(endpointName)) {
                    endpoints[endpointName].removeListener(Linphone.events.ERROR, onCreateError);
                }
            }
            callBackFn.call(callbackContext, err1);
        }
    });
}

export default createPjsipEndpoints;
