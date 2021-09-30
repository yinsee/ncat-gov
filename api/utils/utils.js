"use strict";

const createError = require("http-errors");
const config = require("config");
const BLACKLISTED_ADDRESSES = config.get("blockchain.blacklisted");

module.exports = {
  shortaddress: function (a) {
    return a.substr(0, 6) + '...' + a.substr(-4);
  },
  numberformat: function (n, precision) {
    return n.toFixed(precision || 0).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  },
  assertNotBlackListed: function (address) {
    if (BLACKLISTED_ADDRESSES.includes(address.toLowerCase()))
      throw createError(400, `Blacklisted address ${address}`);
  }
}
