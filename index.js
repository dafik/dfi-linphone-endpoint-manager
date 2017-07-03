"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EndpointManager = require("./src/endpointManager");
let _instance;
function getInstance(server) {
    if (typeof _instance === "undefined") {
        _instance = new EndpointManager(server);
    }
    return _instance;
}
exports.getInstance = getInstance;
//# sourceMappingURL=index.js.map