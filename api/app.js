"use strict";

if (process.env.IS_DOCKER === undefined) require("dotenv/config");

const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const config = require("config");
const path = require("path");
const rfs = require("rotating-file-stream");
const cors = require("cors");
const compression = require('compression');

const models = require("./models");
const { numberformat, shortaddress } = require('./utils/utils');

const logger = require("./utils/logger");
const listeners = require("./listeners");
const jobs = require("./jobs");
const jwtauth = require("./middleware/jwtauth");
const { getTokenPrice } = require("./utils/blockchain");
const { BigNumber } = require("@ethersproject/bignumber");
const accessLogStream = rfs.createStream("access.log", {
  interval: config.get("logging.rotation"),
  path: path.join(__dirname, config.get("logging.folder")),
});

const app = express();
const appPort = config.get("port");
const server = require("http").Server(app);

const whitelist = JSON.parse(process.env.CORS || 'null') || ['http://localhost:4200'];
const corsOptions = {
  credentials: true,
  origin: function (origin, callback) {
    if (origin === undefined || whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}
const io = require("socket.io")(server, { cors: corsOptions });
console.log('Socket initailized');

app.use(cors());
app.use(morgan("combined", { stream: accessLogStream }));
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '../assets')));

// routes
require("./routes")(app, logger);


// home
app.get('/', jwtauth, (req, res) => {
  res.send({ version: '1.0', user: req.user });
})

// websocket
app.io = io; // attach socket to app object

// initialize socket.io
io.on('connection', function (socket) {

  console.log('client connected', socket.id);

  // send socket id to client upon connection
  socket.emit('message', 'Meow!');
  // socket.broadcast.emit('message', socket.id + ' joined the Clowder. NCAT Army grow stronger!');

  // socket.on('message', function (data) {
  //   // todo: handle message
  //   const json = JSON.parse(data);
  //   console.log('received message from', socket.id, json);
  //   io.emit(json.type, json.data);
  // });

  // socket.on('disconnect', function () {
  //   socket.broadcast.emit('message', socket.id + ' has left the Clowder. HODL it!');
  // });
});

// price updater
var price = 0;
function updatePrice() {
  getTokenPrice(BigNumber.from(1).mul(10 ** 9)).then((r) => {
    price = r[2].toNumber() / 10 ** 18;
    console.log('Price', price.toFixed(12));
    app.io.emit('price', price.toFixed(12));
  });
}

// Synchronize DB
models.sequelize.sync().then(async () => {
  // listeners.enableAll();
  jobs.startAll(app);
  server.listen(appPort, () => {
    logger.info(`App is listening on port ${appPort}`);
    updatePrice();
  });

  // run once
  const updateProposals = require("./jobs/update-proposals");
  updateProposals(app);
});


// enable blockchain listening
listeners.start((res) => {

  switch (res.event) {
    case 'Transfer':
      let amount = Math.floor((res.value).div(10 ** 9).toNumber() / 0.91);
      if (res.from == process.env.BLOCKCHAIN_LP_ADDRESS) {
        console.log('🟢', amount);
        app.io.emit('message', '🟢' + shortaddress(res.to) + ' bought ' + numberformat(amount / 10 ** 6) + 'M NCAT');
        updatePrice();
      }
      else if (res.to == process.env.BLOCKCHAIN_LP_ADDRESS) {
        console.log('🔴', amount);
        app.io.emit('message', '🔴' + shortaddress(res.from) + ' sold ' + numberformat(amount / 10 ** 6) + 'M NCAT');
        updatePrice();
      }
      else if (res.to == process.env.BLOCKCHAIN_BURN_ADDRESS) {
        console.log('🔥', amount);
        app.io.emit('message', '🔥' + shortaddress(res.from) + ' burned ' + numberformat(amount / 10 ** 6) + 'M NCAT');
        updatePrice();
        // User.findOneAndUpdate({ address: res.from.toLowerCase() }, { $inc: { balance: amount } }, async (err, user) => {
        // check credit and top up if user exists
        //     if (user && !err) app.io.emit('player', { address: user.address });
        // });
      }
      break;
    default:
      break;
  }
});