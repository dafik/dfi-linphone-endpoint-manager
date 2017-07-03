"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const getServerInstance = require("local-dfi-asterisk/src/asteriskServerInstance");
const index_1 = require("../index");
const EndpointManger = require("../src/endpointManager");
let asterisk;
let endpointManger;
describe("create two", () => {
    function onBefore(done) {
        this.timeout(0);
        assert.doesNotThrow(init, "asterisk init failed");
        function init() {
            asterisk = getServerInstance({
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
        endpointManger = index_1.getInstance(asterisk);
        endpointManger.on(EndpointManger.events.ERROR, onEndpointsError);
        endpointManger.on(EndpointManger.events.ENDPOINTS_SET, onEndpointsSet);
        endpointManger.on(EndpointManger.events.ENDPOINTS_CLEARED, onEndpointsCleared);
        endpointManger.setupEndpoints(2, "udp", "sip", "wszystkie-test");
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
//# sourceMappingURL=002-manager.js.map