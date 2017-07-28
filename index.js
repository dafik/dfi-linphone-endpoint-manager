"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const endpointManager_1 = require("./src/endpointManager");
let _instance;
var endpointManager_2 = require("./src/endpointManager");
exports.EndpointManager = endpointManager_2.EndpointManager;
function getInstance(server) {
    if (typeof _instance === "undefined") {
        _instance = new endpointManager_1.default(server);
    }
    return _instance;
}
exports.default = getInstance;
//# sourceMappingURL=index.js.map