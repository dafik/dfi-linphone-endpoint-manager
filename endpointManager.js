var Linphone = require('local-linphone');
var EventEmitter = require('events').EventEmitter;
var actions = require('local-nami-extended').Actions;
var SimpleMap = require('local-simple-map');

/**
 *
 * @param {AsteriskServer} server
 * @constructor
 * @property {SimpleMap} endpoints
 */
function EndpointManager(server) {
    var _supportedTechnologies = ['sip', 'pjsip'];
    var _endpoints = new SimpleMap();
    var _server = server;

    var _currentPort = (function () {
        var nextId = 5061;
        return function () {
            return nextId++;
        }
    })();
    var _currentRtpPort = (function () {
        var nextId = 7078;
        return function () {
            return ++nextId;
        }
    })();

    Object.defineProperties(this, {
        endpoints: {
            get: function () {
                return _endpoints;
            },
            set: function (endpoints) {
                if (endpoints instanceof Array) {
                    endpoints.forEach(function (endpoint) {
                        //noinspection JSPotentiallyInvalidUsageOfThis
                        this.addEndpoint(endpoint);
                    })
                } else if (!(endpoints instanceof Linphone)) {
                    for (var endpointName in endpoints) {
                        if (endpoints.hasOwnProperty(endpointName)) {
                            //noinspection JSPotentiallyInvalidUsageOfThis
                            this.addEndpoint(endpoints[endpointName]);
                        }
                    }
                } else {
                    //noinspection JSPotentiallyInvalidUsageOfThis
                    this.addEndpoint(endpoints);
                }
            }
        },
        length: {
            get: function () {
                return _endpoints.getLength();
            }
        },
        server: {
            /**
             * @returns {AsteriskServer}
             */
            get: function () {
                return _server;
            }
        },
        currentPort: {
            get: function () {
                return _currentPort();
            }
        },
        currentRtpPort: {
            get: function () {
                return _currentRtpPort();
            }
        }
    });

    this.events = {
        endpointsSet: 'endpointsSet',
        endpointsCleared: 'endpointsCleared',
        error: 'error'
    };


    /**
     * @param {Linphone} endpoint
     */
    this.addEndpoint = function (endpoint) {
        if (!(endpoint instanceof Linphone)) {
            throw new TypeError('endpoint must be Linphone prototype but found: ' + endpoint.__proto__.constructor.name)
        }
        endpoint.on(Linphone.Events.CLOSE, function () {
            if (_endpoints.has(endpoint.configuration.sip)) {
                _endpoints.remove(endpoint.configuration.sip);
                if (_endpoints.getLength() == 0) {
                    this.emit(this.events.endpointsCleared);
                }
            }
        }.bind(this));
        _endpoints.add(endpoint.configuration.sip, endpoint);
    };
    this.setupEndpoints = function (howMany, transport, technology, context) {
        howMany = howMany || 2;
        transport = transport || 'udp';
        technology = this.chooseTechnology(technology, onTechnologyChoose, this);

        function onTechnologyChoose(technology) {
            if (technology == 'pjsip') {
                createPjsipEndpoints.call(this, _server, transport, howMany, context, onCreated, this);
            } else if (technology == 'sip') {
                createSipEndpoints.call(this, _server, transport, howMany, context, onCreated, this);
            } else {
                throw new TypeError(technology + 'technology not supported yet');
            }
        }

        function onCreated(err, endpoints) {
            if (err) {
                //noinspection JSPotentiallyInvalidUsageOfThis
                this.emit(this.events.error, err);
                return
            }
            this.endpoints = endpoints;
            //noinspection JSPotentiallyInvalidUsageOfThis
            this.emit(this.events.endpointsSet);
        }
    };
    this.clear = function (callback, thisp) {
        var waitForExit = 0;

        function finish() {
            waitForExit--;
            if (waitForExit == 0) {
                if (typeof callback == "function") {
                    callback.call(thisp);
                }
            }
        }

        function onEachEndpoint(endpoint) {
            endpoint.on(Linphone.Events.CLOSE, onEndpointExit);
            endpoint.exit();
        }

        function onEndpointExit(endpoint) {
            endpoint.removeListener(Linphone.Events.CLOSE, onEndpointExit);

            finish();
        }

        if (_endpoints.getLength() > 0) {
            waitForExit = _endpoints.getLength();
            _endpoints.forEach(onEachEndpoint)
        } else {
            waitForExit = 1;
            finish();
        }

    }

    this.chooseTechnology = function (technology, callback, thisp) {

        var available = [];
        Object.keys(this.server.channelManager.technologyCount).forEach(function (name) {
            available.push(name.toLowerCase());
        });
        var tmp = []
        available.forEach(function (name) {
            if (-1 !== _supportedTechnologies.indexOf(name.toLowerCase())) {
                tmp.push(name);
            }
        })
        available = tmp;


        if (-1 !== available.indexOf(technology.toLowerCase())) {
            callback.call(thisp, technology.toLowerCase());
        } else {
            callback.call(thisp, available[0]);
        }
    }
}
util.inherits(EndpointManager, EventEmitter);

/**
 * @type {EndpointManager}
 */
var instance;
/**
 * @returns {EndpointManager}
 */
module.exports.getInstance = function (server) {
    if (typeof instance == "undefined") {
        instance = new EndpointManager(server);
        global['endpointManager'] = instance;
    }
    return instance;
};

/**
 *
 * @param {AsteriskServer} server
 * @param {string} transport
 * @param {number} howMany
 * @param {function(err,Linphone[])} callBack
 * @param {*} [thisp] callBack thisArg
 */
function createPjsipEndpoints(server, transport, howMany, context, callBack, thisp) {

    var action;
    var endpoints = {};
    var foundEndpoints = {};
    var waitForEndpoint = 0;
    var waitForCreate = 0;

    server.dbDelTree('registrar', onDbDelTree.bind(this));


    function onDbDelTree(err) {
        if (err) {
            callBack.call(thisp, err);
            return
        }
        action = new actions.PjsipShowEndpointsAction();
        server.sendAction(action, onPjsipShowEndpoints.bind(this))
    }

    function onPjsipShowEndpoints(err, response) {
        if (err) {
            callBack.call(thisp, err);
            return
        }
        /**
         * @type {ManagerResponse}
         */
        var commandResponse = response;
        for (var i = 0; i < commandResponse.getEvents().length; i++) {
            /**
             * @type {{transport,objectname}}
             */
            var endpoint = commandResponse.getEvents()[i];
            if (endpoint.transport == 'transport-udp') {
                foundEndpoints[endpoint.objectname] = endpoint
            }
        }
        for (var name in foundEndpoints) {
            if (foundEndpoints.hasOwnProperty(name)) {
                /**
                 * @type {PjsipShowEndpointAction}
                 */
                action = new actions.PjsipShowEndpointAction();
                action.setEndpoint(name);
                waitForEndpoint++;

                server.sendAction(action, onPjsipShowEndpoint.bind(this))
            }
        }
    }

    function onPjsipShowEndpoint(err, response) {
        if (err) {
            callBack.call(thisp, err);
            return
        }
        waitForEndpoint--;
        for (var i = 1; i < response.getEvents().length; i++) {
            var cr = response.getEvents()[i];
            if (cr.event == 'AuthDetail') {
                foundEndpoints[cr.objectname].password = cr.password;
                if (waitForEndpoint == 0) {
                    ready.call(this);
                    return;
                }
            }
        }
    }

    function ready() {
        var linphone, pjSipConf, pjSips = Object.keys(foundEndpoints);
        for (var i = 0; i < howMany; i++) {
            waitForCreate++;
            pjSipConf = foundEndpoints[pjSips[i]];
            linphone = new Linphone({
                port: this.currentPort,
                rtpPort: this.currentRtpPort,
                sip: pjSipConf.objectname,
                password: pjSipConf.password,
                host: server.configuration.server.host,
                technology: 'PJSIP'
            });
            linphone.once(Linphone.Events.REGISTERED, onCreateClient.bind(this));
            linphone.on(Linphone.Events.ERROR, onCreateError.bind(this));
            endpoints[pjSips[i]] = linphone;
        }
    }

    function onCreateClient() {
        waitForCreate--;
        if (waitForCreate == 0) {
            callBack.call(thisp, null, endpoints);
        }
    }

    function onCreateError(err) {
        for (var endpointName in endpoints) {
            if (endpoints.hasOwnProperty(endpointName)) {
                endpoints[endpointName].removeListener(Linphone.Events.ERROR, onCreateError);
            }
        }
        callBack.call(thisp, err);
    }
}

/**
 *
 * @param {AsteriskServer} server
 * @param {string} transport
 * @param {number} howMany
 * @param context
 * @param {function(err,Linphone[])} callBack
 * @param {*} [thisp] callBack thisArg
 */
function createSipEndpoints(server, transport, howMany, context, callBack, thisp) {

    var action;
    var endpoints = {};
    var foundEndpoints = {};
    var waitForEndpoint = 0;
    var waitForCreate = 0;

    server.dbDelTree('registrar', onDbDelTree.bind(this));


    function onDbDelTree(err) {
        if (err) {
            callBack.call(thisp, err);
            return
        }


        //foundEndpoints.forEach(function (endpoint) {

        /**
         * @type {PjsipShowEndpointAction}
         */
        action = new actions.CommandAction();
        action.setCommand('sip show users');

        server.sendAction(action, onSipShowUsers.bind(this));

        //})
    }

    function onSipShowUsers(err, response) {
        var endpoint = 1;
        endpoints = server.peerManager.peers.get('SIP');

        var re = /(\d+)\s+([a-z]+)\s+([a-z-_]+)\s+(Yes|No)\s+(Yes|No)/;
        var match = 'd';
        var foundEndpointsTmp = [];
        response.getResults().forEach(onEachLine);
        function onEachLine(line) {
            match = line.split(/\s+/);
            if (context && context == match[2]) {
                if (endpoints.has(match[0])) {
                    endpoint = endpoints.get(match[0]);
                    //noinspection JSPrimitiveTypeWrapperUsage
                    endpoint.password = match[1];
                    //noinspection JSPrimitiveTypeWrapperUsage
                    endpoint.context = match[2];

                    foundEndpointsTmp[endpoint.objectname] = endpoint;
                }
            }
        }

        if (howMany > foundEndpointsTmp) {
            throw new Error('requested phone was: "' + howMany + '" but match configuration found is: "' + foundEndpointsTmp.length + '"');
        }

        waitForEndpoint = Object.keys(foundEndpointsTmp).length;
        for (var i = 0; i < waitForEndpoint; i++) {
            endpoint = foundEndpointsTmp[Object.keys(foundEndpointsTmp)[i]];
            action = new actions.CommandAction();
            action.setCommand('sip show peer ' + endpoint.objectname);

            server.sendAction(action, onSipShowPeer.bind(this));

        }

        function onSipShowPeer(err, resp) {
            waitForEndpoint--;
            var result = resp.getResults();
            var name;
            result.forEach(function (line) {
                if (-1 !== line.indexOf('* Name')) {
                    var parts = line.split(':');
                    name = parts[1].trim();
                }

                if (-1 !== line.indexOf('Allowed.Trsp')) {
                    var transports = line.replace('Allowed.Trsp :', '').trim().split(',');
                    if (-1 !== transports.indexOf(transport.toUpperCase())) {
                        endpoint = foundEndpointsTmp[name];
                        foundEndpoints[endpoint.objectname] = endpoint;
                    }
                }
            });
            if (waitForEndpoint == 0) {
                //endpoints = foundEndpoints;

                ready.call(this);
            }
        }


    }


    function ready() {
        endpoints = {};
        var linphone, pjSipConf, pjSips = Object.keys(foundEndpoints);
        for (var i = 0; i < howMany; i++) {
            waitForCreate++;
            pjSipConf = foundEndpoints[pjSips[i]];
            linphone = new Linphone({
                port: this.currentPort,
                rtpPort: this.currentRtpPort,
                sip: pjSipConf.objectname,
                password: pjSipConf.password,
                host: server.configuration.server.host,
                technology: 'SIP'
            });
            linphone.once(Linphone.Events.REGISTERED, onCreateClient.bind(this));
            linphone.on(Linphone.Events.ERROR, onCreateError.bind(this));
            endpoints[pjSips[i]] = linphone;
        }
    }

    function onCreateClient() {
        waitForCreate--;
        if (waitForCreate == 0) {
            callBack.call(thisp, null, endpoints);
        }
    }

    function onCreateError(err) {
        for (var endpointName in endpoints) {
            if (endpoints.hasOwnProperty(endpointName)) {
                endpoints[endpointName].removeListener(Linphone.Events.ERROR, onCreateError);
            }
        }
        callBack.call(thisp, err);
    }
}