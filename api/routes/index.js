"use strict";

const jwt = require('jsonwebtoken');
const jwtauth = require('../middleware/jwtauth');
const { isValidAddress } = require("../utils/blockchain");
const accessTokenSecret = process.env.JWT_SECRET;
const { sequelize } = require("../models");
const usersRepository = require("../repositories/users");

module.exports = (app, logger) => {
  app.get('/login', async (req, res, next) => {
    var address = req.query.address.trim().toLowerCase();
    if (!isValidAddress(address)) {
      return next(createError(400, "Invalid address"));
    }

    let t = await sequelize.transaction();
    try {
      let user = await usersRepository.findByAddress(address, t, true);
      var token = jwt.sign({ address: address }, accessTokenSecret);
      res.json({ token, address, a: user ? user.isAdmin : false });
    } catch (error) {
      return next(createError(400, error));
    }
  });

  app.use("/proposals", jwtauth, require("./proposals"));

  // error handler
  app.use(function (err, req, res, next) {
    if (!err.status || err.status >= 500) {
      logger.error("unhandled error occured: %O", err);
      res.status(500).json({ message: "Internal server error" });
    } else {
      logger.warn(err.message);
      res.status(err.status).json({ message: err.message });
    }
  });
};
