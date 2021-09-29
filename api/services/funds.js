"use strict";

const config = require("config");
const { sequelize } = require("../models");
const repository = require("../repositories/funds");
const usersRepository = require("../repositories/users");
const proposalsRepository = require("../repositories/proposals");
const { assertNotBlackListed } = require("../utils/utils");

const fund = async (funder, proposalId, txHash, amount) => {
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

    await repository.save(
      {
        funderAddress: funder,
        proposalId,
        txHash,
        amount,
      },
      t
    );

    await proposalsRepository.updateById(
      proposalId,
      {
        raised_fund: proposal.raised_fund + amount,
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
