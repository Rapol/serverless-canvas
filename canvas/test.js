const AWS = require('aws-sdk');
const mqtt = require('mqtt');

const IOT_ENDPOINT = "a3qmkpgch0y8um.iot.us-east-1.amazonaws.com";
const REGION = "us-east-1";
const IDENTITY_POOL_ID = "us-east-1:e65de498-250f-4080-b949-9e3bacb3f056";

// Configure Cognito identity pool
AWS.config.region = REGION;

var credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: IDENTITY_POOL_ID,
});

// Getting AWS creds from Cognito is async, so we need to drive the rest of the mqtt client initialization in a callback
credentials.get(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    var requestUrl = SigV4Utils.getSignedUrl(IOT_ENDPOINT, REGION, credentials);
    initClient(requestUrl);
});

// Connect the client, subscribe to the drawing topic, and publish a "hey I connected" message
function initClient(requestUrl) {
    var client = mqtt.connect(requestUrl)

    client.on('connect', function (data) {
        client.subscribe('canvas');
    })

    client.on('reconnect', function () {
        client.end();
    })

    client.on('message', function (topic, message) {
        // message is Buffer
        console.log(message.toString())
        client.end()
    })
}

/**
  * utilities to do sigv4
  * @class SigV4Utils
  */
function SigV4Utils() { }

SigV4Utils.getSignatureKey = function (key, date, region, service) {
    var kDate = AWS.util.crypto.hmac('AWS4' + key, date, 'buffer');
    var kRegion = AWS.util.crypto.hmac(kDate, region, 'buffer');
    var kService = AWS.util.crypto.hmac(kRegion, service, 'buffer');
    var kCredentials = AWS.util.crypto.hmac(kService, 'aws4_request', 'buffer');
    return kCredentials;
};

SigV4Utils.getSignedUrl = function (host, region, credentials) {
    var datetime = AWS.util.date.iso8601(new Date()).replace(/[:\-]|\.\d{3}/g, '');
    var date = datetime.substr(0, 8);

    var method = 'GET';
    var protocol = 'wss';
    var uri = '/mqtt';
    var service = 'iotdevicegateway';
    var algorithm = 'AWS4-HMAC-SHA256';

    var credentialScope = date + '/' + region + '/' + service + '/' + 'aws4_request';
    var canonicalQuerystring = 'X-Amz-Algorithm=' + algorithm;
    canonicalQuerystring += '&X-Amz-Credential=' + encodeURIComponent(credentials.accessKeyId + '/' + credentialScope);
    canonicalQuerystring += '&X-Amz-Date=' + datetime;
    canonicalQuerystring += '&X-Amz-SignedHeaders=host';

    var canonicalHeaders = 'host:' + host + '\n';
    var payloadHash = AWS.util.crypto.sha256('', 'hex')
    var canonicalRequest = method + '\n' + uri + '\n' + canonicalQuerystring + '\n' + canonicalHeaders + '\nhost\n' + payloadHash;

    var stringToSign = algorithm + '\n' + datetime + '\n' + credentialScope + '\n' + AWS.util.crypto.sha256(canonicalRequest, 'hex');
    var signingKey = SigV4Utils.getSignatureKey(credentials.secretAccessKey, date, region, service);
    var signature = AWS.util.crypto.hmac(signingKey, stringToSign, 'hex');

    canonicalQuerystring += '&X-Amz-Signature=' + signature;
    if (credentials.sessionToken) {
        canonicalQuerystring += '&X-Amz-Security-Token=' + encodeURIComponent(credentials.sessionToken);
    }

    var requestUrl = protocol + '://' + host + uri + '?' + canonicalQuerystring;
    return requestUrl;
};
