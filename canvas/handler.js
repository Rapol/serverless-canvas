'use strict';

const aws = require('aws-sdk');

const db = require('./db.js');

const iotdata = new aws.IotData({ endpoint: process.env.IOT_ENDPOINT });

const CANVAS_TOPIC = "/canvas"

const methods = {
  GET: getCanvas,
  PUT: putCanvas
}

const headers = {
  "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
  "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
}

module.exports.canvas = (event, context, cb) => {
  const method = methods[event.httpMethod];
  if (!method) {
    const response = {
      statusCode: 500,
      body: JSON.stringify({ error: `HTTP method ${method} not supported` })
    };
    return cb(response);
  }
  return method(event, context, cb);
}

function getCanvas(event, context, cb) {

  const client = db.createConnection();

  client.connect()
    .then(function () {
      return client.execute(`SELECT * FROM ${process.env.CASSANDRA_BOARD}`);
    })
    .then(function (result) {
      const response = {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
      return cb(null, response);
    })
    .catch(function (err) {
      console.log(err);
      const response = {
        statusCode: 500,
        error: JSON.stringify(err)
      };
      return cb(response);
    })
    .then(() => {
      return client.shutdown();
    })
};

function putCanvas(event, context, cb) {

  const body = valdiatePutCanvas(event.body);

  if (!body) {
    const response = {
      statusCode: 400
    }
    return cb(response);
  }

  const client = db.createConnection();

  client.connect()
    .then(function () {
      // Upsert pixel into board
      return client.execute(`INSERT INTO ${process.env.CASSANDRA_BOARD} (x,y,user,color,timestamp) VALUES (:x, :y, :user, :color, toTimestamp(now()))`, body, { prepare: true });
    })
    .then(function (result) {
      const message = {
        x: body.x,
        y: body.y,
        color: body.color
      }
      // Notify all users about the updated pixel
      return publishTopic(CANVAS_TOPIC, message);
    })
    .then(() => {
      const response = {
        statusCode: 200,
        headers
      };
      return cb(null, response);
    })
    .catch(function (err) {
      console.log(err);
      const response = {
        statusCode: 500,
        error: JSON.stringify(err)
      };
      return cb(response);
    })
    .then(() => {
      // Tear down cassandra client after every lambda invocation
      return client.shutdown();
    })
};

function valdiatePutCanvas(body) {
  if (!body) {
    return;
  }
  try {
    body = JSON.parse(body);
    if (body && body.color && body.user && checkRange(body.x, body.y) && isHexColor(body.color))
      return body;
    else
      return;
  } catch (e) {
    return;
  }
}

function isHexColor(color) {
  if(!color && color[0] !== "#"){
    return false;
  }
  color = color.slice(1);
  return (typeof color === "string") && (color.length === 6)
    && !isNaN(parseInt(color, 16));
}

function checkRange(x, y) {
  return x >= 0 && x < process.env.BOARD_X_MAX && y >= 0 && y < process.env.BOARD_Y_MAX;
}

function publishTopic(topic, message) {
  return new Promise((resolve, reject) => {
    const params = {
      topic: topic,
      payload: JSON.stringify(message),
      qos: 0
    };
    iotdata.publish(params, function (err, data) {
      // ignore any publish errors
      resolve();
    });
  })
}