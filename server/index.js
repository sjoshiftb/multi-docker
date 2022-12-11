const keys = require("./keys");
// EXPRESS APP SETUP
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// POSTGRESS CLIENT SETUP
const { Pool } = require("pg");

const {
    pgPassword: password,
    pgUser: user,
    pgHost: host,
    pgDatabase: database,
    pgPort: port,
} = keys;

const pgClient = new Pool({
    host,
    port,
    user,
    database,
    password,
});

pgClient.on("connect", (client) => {
    client
        .query("CREATE TABLE IF NOT EXISTS values (number INT)")
        .catch((err) => console.error(err));
});

// REDIS CLIENT SETUP
const redis = require("redis");
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000,
});

const redisPublisher = redisClient.duplicate();

// EXPRESS ROUTE HANDLERS

app.get("/", (req, res) => {
    res.send("Hello There");
});

app.get("/values/all", async (req, res) => {
    const values = await pgClient.query("SELECT * from values");
    res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
    redisClient.hgetall("values", (err, values) => {
        res.send(values);
    });
});

app.post("/values", async (req, res) => {
    const index = req.body.index;

    const parsedIndex = parseInt(index);

    if (parsedIndex > 40) {
        return res.status(422).send("Index too high");
    }

    redisClient.hset("values", index, "Nothing yet!");
    redisPublisher.publish("insert", index);
    pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);
    res.send({ working: true });
});

app.listen(5000, () => {
    console.log("Listening on port 5000");
});
