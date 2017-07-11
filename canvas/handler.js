'use strict';

const db = require('./db.js');

const methods = {
  GET: getCanvas,
  PUT: putCanvas
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
        body: JSON.stringify(result.rows)
      };
      return cb(null, response);
    })
    .catch(function (err) {
      console.log(err);
      const response = {
        statusCode: 500
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

  let client = db.createConnection();

  client.connect()
    .then(function () {
      return client.execute(`INSERT INTO ${process.env.CASSANDRA_BOARD} (x,y,user,color,timestamp) VALUES (:x, :y, :user, :color, toTimestamp(now()))`, body, { prepare: true });
    })
    .then(function (result) {
      const response = {
        statusCode: 200,
      };
      return cb(null, response);
    })
    .catch(function (err) {
      console.log(err);
      const response = {
        statusCode: 500
      };
      return cb(response);
    })
    .then(() => {
      return client.shutdown();
    })
};

function valdiatePutCanvas(body) {
  if (!body) {
    return;
  }
  try {
    body = JSON.parse(body);
    if (body && body.color && body.x && body.y && body.user && checkRange(body.x, body.y))
      return body;
    else
      return;
  } catch (e) {
    return;
  }
}

function checkRange(x, y) {
  return x >= 0 && x < process.env.BOARD_X_MAX && y >= 0 && y < process.env.BOARD_Y_MAX;
}