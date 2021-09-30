"use strict";

const logger = require("../utils/logger");
const { updateStates } = require("../services/proposals");

module.exports = async (app) => {
  logger.info("Updating proposals...");
  await updateStates(app);
};
