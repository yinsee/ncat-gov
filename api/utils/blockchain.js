"use strict";

const { Contract, utils, getDefaultProvider } = require("ethers");

const config = require("config");

const NCAT_ADDRESS = config.get("blockchain.ncat.address");
const NCAT_ABI = config.get("blockchain.ncat.abi");
const ROUTER_ADDRESS = config.get("blockchain.router.address");
const ROUTER_ABI = config.get("blockchain.router.abi");
const NETWORK = config.get("blockchain.network");

const defaultProvider = getDefaultProvider(NETWORK);

const roContract = new Contract(NCAT_ADDRESS, NCAT_ABI, defaultProvider);

const isValidAddress = (addr) => {
  try {
    utils.getAddress(addr);
    return true;
  } catch (error) {
    return false;
  }
};

const getLatestBlockNumber = () => {
  return defaultProvider.getBlockNumber();
};

const balanceOf = (address) => roContract.balanceOf(address);

// v1 read
const routerContract = new Contract(ROUTER_ADDRESS, ROUTER_ABI, defaultProvider);

const getTokenPrice = (amount) => {
  return routerContract.getAmountsOut(amount, [
    NCAT_ADDRESS,
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // BNB
    '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
  ]);
}

module.exports = {
  defaultProvider,
  roContract,
  balanceOf,
  isValidAddress,
  getLatestBlockNumber,
  getTokenPrice,
};
