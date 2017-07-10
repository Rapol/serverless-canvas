CREATE KEYSPACE canvas
WITH replication = {'class':'SimpleStrategy', 'replication_factor' : 3};

Create table board
(
  x int,
  y int,
  timestamp timestamp,
  user text,
  color text,
  Primary key((x,y))
);