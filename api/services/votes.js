"use strict";

const config = require("config");
const createError = require("http-errors");
const { sequelize } = require("../models");
const repository = require("../repositories/votes");
const usersRepository = require("../repositories/users");
const proposalsRepository = require("../repositories/proposals");
const { assertNotBlackListed } = require("../utils/utils");
const { BigNumber } = require("ethers");
const DECIMALS = config.get("blockchain.ncat.decimals");
const { PROPOSAL_STATES } = require("../models/Proposal");
const { NCAT_PER_VOTE } = require("../models/User");

const vote = async (voter, proposalId, support) => {
  assertNotBlackListed(voter);

  let user;
  let t = await sequelize.transaction();
  try {
    user = await usersRepository.findByAddress(voter, t, true);
    if (!user) {
      user = await usersRepository.save({ address: voter }, t);
    }
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  t = await sequelize.transaction();
  try {
    const canVote = await user.canVote();
    if (!canVote) {
      throw createError(
        400,
        `You should own at least ${NCAT_PER_VOTE.div(10 ** DECIMALS).toString()} NCAT to vote`
      );
    }
    const userWeight = await user.getVotes();
    const proposal = await proposalsRepository.findById(proposalId, t, true);
    const now = new Date().getTime();
    if (
      proposal.state !== PROPOSAL_STATES.VOTING ||
      now > proposal.expiration.getTime()
    ) {
      throw createError(400, "Voting has ended");
    }

    await repository.save(
      {
        voterAddress: voter,
        proposalId,
        support,
        weight: userWeight.toHexString(),
      },
      t
    );

    if (support) {
      await proposalsRepository.updateById(
        proposalId,
        {
          // ...proposal,
          for: BigNumber.from(proposal.for).add(userWeight).toHexString(),
          voters: proposal.voters.concat(voter),
        },
        t
      );
    } else {
      await proposalsRepository.updateById(
        proposalId,
        {
          // ...proposal,
          against: BigNumber.from(proposal.against).add(userWeight).toHexString(),
          voters: proposal.voters.concat(voter),
        },
        t
      );
    }
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  return await proposalsRepository.findById(proposalId, null, false);
};

module.exports = {
  vote,
};
