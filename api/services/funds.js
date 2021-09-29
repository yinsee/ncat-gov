"use strict";

const config = require("config");
const createError = require("http-errors");
const { sequelize } = require("../models");
const repository = require("../repositories/funds");
const usersRepository = require("../repositories/users");
const proposalsRepository = require("../repositories/proposals");
const { assertNotBlackListed } = require("../utils/utils");
const { BigNumber } = require("ethers");
const DECIMALS = config.get("blockchain.ncat.decimals");
const { PROPOSAL_STATES } = require("../models/Proposal");
const { NCAT_PER_VOTE } = require("../models/User");

const fund = async (funder, proposalId, txvalue) => {
  assertNotBlackListed(funder);

  // validate transaction

  let user;
  let t = await sequelize.transaction();
  try {
    user = await usersRepository.findByAddress(funder, t, true);
    if (!user) {
      user = await usersRepository.save({ address: funder }, t);
    }
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  t = await sequelize.transaction();
  try {
    const proposal = await proposalsRepository.findById(proposalId, t, true);
    // const now = new Date().getTime();
    // if (
    //   proposal.state !== PROPOSAL_STATES.FUNDING ||
    //   now > proposal.expiration.getTime()
    // ) {
    //   throw createError(400, "Funding has ended");
    // }


    await repository.save(
      {
        funderAddress: funder,
        proposalId,
        amount: txvalue,
      },
      t
    );

    await proposalsRepository.updateById(
      proposalId,
      {
        raised_fund: proposal.raised_fund + txvalue,
        funders: Array.from(new Set(proposal.funders.concat(funder))),
      },
      t
    );
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  t = await sequelize.transaction();
  return await proposalsRepository.findById(proposalId, t, false);
};

module.exports = {
  fund,
};
