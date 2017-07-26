import assert = require("assert");
import getServerInstance = require("local-dfi-asterisk/src/asteriskServerInstance");
import EndpointManger  = require("../src/endpointManager");
import {getInstance} from "../index";

let asterisk;
let endpointManger;

describe("create two", () => {
    function onBefore(done) {
        //this.timeout(0);

        assert.doesNotThrow(init, "asterisk init failed");

        function init() {

            asterisk = getServerInstance({
                config: {
                    managers: {
                        agent: false,
                        bridge: false,
                        channel: true,
                        dahdi: false,
                        device: false,
                        peer: true,
                        queue: false
                    },
                    server: {
                        // host: "localhost",
                        host: "pbx",
                        port: "5038",
                        secret: "node@pbx",
                        username: "node"
                    }
                }
            });
            asterisk.start()
                .then(() => {
                    done();
                })
                .catch((err) => {
                    if (err) {
                        done();
                        throw  err;
                    }
                });
        }
    }

    function twoSetup(done) {
        this.timeout(80000);

        function onEndpointsError(err) {
            throw err;
        }

        function onEndpointsSet() {
            endpointManger.removeListener(EndpointManger.events.ENDPOINTS_SET, onEndpointsSet);
            endpointManger.clear();
        }

        function onEndpointsCleared() {
            endpointManger.removeListener(EndpointManger.events.ENDPOINTS_CLEARED, onEndpointsCleared);
            endpointManger.removeListener(EndpointManger.events.ERROR, onEndpointsError);
            done();
        }

        endpointManger = getInstance(asterisk);

        endpointManger.on(EndpointManger.events.ERROR, onEndpointsError);
        endpointManger.on(EndpointManger.events.ENDPOINTS_SET, onEndpointsSet);
        endpointManger.on(EndpointManger.events.ENDPOINTS_CLEARED, onEndpointsCleared);

        endpointManger.setupEndpoints(2, "pbx", "udp", "sip", "wszystkie-test");

    }

    function onAfter(done) {
        this.timeout(1000000);
        endpointManger.clear(() => {
            done();
        });
    }

    before(onBefore);
    it("setupTwo", twoSetup);
    after(onAfter);
});
