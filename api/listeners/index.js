"use strict";
const { roContract } = require("../utils/blockchain");


const events = [
  'Transfer',
  //  'Approval', 'MinTokensBeforeSwapUpdated',
  // 'OwnershipTransferred', 'SwapAndLiquify', 'SwapAndLiquifyEnabledUpdated',
];

module.exports = {
  start: (callback) => {
    events.forEach((event) => {
      roContract.on(event, async (from, to, value, raw) => {
        callback({ event, from, to, value, raw });
      });
    });
  },
};
