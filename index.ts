import EndpointManager = require("./src/endpointManager");
let _instance;

export function getInstance(server): EndpointManager {
    if (typeof _instance === "undefined") {
        _instance = new EndpointManager(server);
    }
    return _instance;
}
