import EndpointManager from "./src/endpointManager";

let _instance;

export {EndpointManager} from "./src/endpointManager";
export default function getInstance(server): EndpointManager {
    if (typeof _instance === "undefined") {
        _instance = new EndpointManager(server);
    }
    return _instance;
}
