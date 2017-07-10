'use strict';

const db = require('./db.js');

const methods = {
  GET: getCanvas,
  PUT: putCanvas
}

module.exports.handler = (event, context, cb) => {
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

  let client = db.createConnection();

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

  let body = valdiatePutCanvas(event.body);

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
  else {
    try {
      body = JSON.parse(body);
      if (body && body.color && body.x && body.y && body.user)
        return body;
      else
        return;
    } catch (e) {
      return;
    }
  }
}