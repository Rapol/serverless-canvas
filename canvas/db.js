const cassandra = require('cassandra-driver');

const authProvider = new cassandra.auth.PlainTextAuthProvider(process.env.CASSANDRA_USER, process.env.CASSANDRA_PASSWORD);

module.exports.createConnection = () => {
  return new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_IP],
    keyspace: process.env.CASSANDRA_KEYSPACE,
    authProvider
  });
}