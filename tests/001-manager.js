"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const getServerInstance = require("local-dfi-asterisk/src/asteriskServerInstance");
const index_1 = require("../index");
const EndpointManger = require("../src/endpointManager");
let asterisk;
let endpointManger;
process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
    // application specific logging, throwing an error, or other logic here
});
describe("create one", () => {
    function onBefore(done) {
        this.timeout(0);
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
                    throw err;
                }
            });
        }
    }
    function oneSetup(done) {
        this.timeout(5000);
        function onEndpoinsError(err) {
            throw err;
        }
        function onEndpoinsSet() {
            assert.equal(endpointManger.endpoints.size, 1);
            endpointManger.removeListener(EndpointManger.events.ENDPOINTS_SET, onEndpoinsSet);
            endpointManger.clear();
        }
        function onEndpoinsCleared() {
            endpointManger.removeListener(EndpointManger.events.ENDPOINTS_CLEARED, onEndpoinsCleared);
            endpointManger.removeListener(EndpointManger.events.ERROR, onEndpoinsError);
            done();
        }
        endpointManger = index_1.getInstance(asterisk);
        endpointManger.on(EndpointManger.events.ERROR, onEndpoinsError);
        endpointManger.on(EndpointManger.events.ENDPOINTS_SET, onEndpoinsSet);
        endpointManger.on(EndpointManger.events.ENDPOINTS_CLEARED, onEndpoinsCleared);
        endpointManger.setupEndpoints(1, "udp", "sip", "wszystkie-test");
    }
    function onAfter(done) {
        this.timeout(1000000);
        endpointManger.clear(() => {
            done();
        });
    }
    before(onBefore);
    it("setupOne", oneSetup);
    after(onAfter);
});
//# sourceMappingURL=001-manager.js.map