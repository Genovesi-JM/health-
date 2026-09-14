'use strict';
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const dgram = require('node:dgram');
function denied() { throw new Error('PHASE0_CLIENT_NETWORK_DENIED'); }
net.Socket.prototype.connect = denied;
net.connect = denied;
net.createConnection = denied;
http.request = denied; http.get = denied;
https.request = denied; https.get = denied;
dgram.createSocket = denied;
globalThis.fetch = denied;
