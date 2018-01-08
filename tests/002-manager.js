"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const asteriskServerInstance_1 = require("dfi-asterisk/src/asteriskServerInstance");
const fs_1 = require("fs");
const index_1 = require("../index");
const endpointManager_1 = require("../src/endpointManager");
let asteriskConfig;
let asterisk;
let endpointManger;
describe("create two", () => {
    function onBefore(done) {
        // this.timeout(0);
        asteriskConfig = JSON.parse(fs_1.readFileSync("tests/config.json", "utf8"));
        assert.doesNotThrow(init, "asterisk init failed");
        function init() {
            asterisk = asteriskServerInstance_1.getServerInstance({
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
                    server: asteriskConfig.asteriskServer
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
            endpointManger.removeListener(endpointManager_1.default.events.ENDPOINTS_SET, onEndpointsSet);
            endpointManger.clear();
        }
        function onEndpointsCleared() {
            endpointManger.removeListener(endpointManager_1.default.events.ENDPOINTS_CLEARED, onEndpointsCleared);
            endpointManger.removeListener(endpointManager_1.default.events.ERROR, onEndpointsError);
            done();
        }
        endpointManger = index_1.getInstance(asterisk);
        endpointManger.on(endpointManager_1.default.events.ERROR, onEndpointsError);
        endpointManger.on(endpointManager_1.default.events.ENDPOINTS_SET, onEndpointsSet);
        endpointManger.on(endpointManager_1.default.events.ENDPOINTS_CLEARED, onEndpointsCleared);
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
//# sourceMappingURL=002-manager.js.map