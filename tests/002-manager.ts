import * as assert from "assert";
import {getServerInstance} from "dfi-asterisk/src/asteriskServerInstance";
import {readFileSync} from "fs";
import {getInstance} from "../index";
import EndpointManger from "../src/endpointManager";

let asteriskConfig;
let asterisk;
let endpointManger;

describe("create two", () => {
    function onBefore(done) {
        // this.timeout(0);

        asteriskConfig = JSON.parse(readFileSync("tests/config.json", "utf8"));

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
