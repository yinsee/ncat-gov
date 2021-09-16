"use strict";

const config = require("config");
const { Op } = require("sequelize");
const { sequelize } = require("../models");
const repository = require("../repositories/proposals");
const usersRepository = require("../repositories/users");

const createError = require("http-errors");
const { assertNotBlackListed } = require("../utils/utils");
const DECIMALS = config.get("blockchain.ncat.decimals");

const { MIN_PROPOSAL_BALANCE } = require("../models/User");
const { BigNumber } = require("ethers");
const { PROPOSAL_STATES, REQUIRE_WEIGHT, REQUIRE_PERCENTAGE } = require("../models/Proposal");
const logger = require("../utils/logger");

const findAllByPage = (page) => repository.findAllByPage(page);

const save = async (proposal) => {
  const author = proposal.author;
  assertNotBlackListed(author);

  let user;
  let t = await sequelize.transaction();
  try {
    user = await usersRepository.findByAddress(author, t, true);
    if (!user) {
      user = await usersRepository.save({ address: author }, t);
    }
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  t = await sequelize.transaction();
  try {
    const canPropose = await user.canPropose();
    if (!canPropose) {
      throw createError(
        400,
        `You should own at least ${MIN_PROPOSAL_BALANCE.div(10 ** DECIMALS).toString()} APE-X to create a proposal`
      );
      return;
    }
    await repository.save(
      {
        title: proposal.title,
        author: proposal.author,
        content: proposal.content,
        target_fund: proposal.target_fund,
        require_fund: proposal.require_fund,
        contact: proposal.contact,
        contact_type: proposal.contact_type,
        has_expire: proposal.has_expire,
        expire_date: proposal.expire_date,
      },
      t
    );
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

const updateStates = async () => {
  const proposals = (await repository.findAllWhere({
    // state: {
    //   [Op.notIn]: [
    //     PROPOSAL_STATES.COMPLETED,
    //     PROPOSAL_STATES.REJECTED,
    //   ]
    // }
  }));
  const now = new Date().getTime();
  const t = await sequelize.transaction();
  return Promise.all(
    proposals.map((proposal) => {
      /*
      VOTING: "Voting",
      RESEARCH: "Research",
      FUNDING: "Funding",
      IMPLEMENTATION: "Implementation",
      */
      if (proposal.has_expire) {
        // check expire date
        if (now > proposal.expire_date.getTime()) {
          console.log('expired', proposal.expire_date);
          return repository.updateById(proposal.id, { state: PROPOSAL_STATES.REJECTED }, t);
        }
      }

      switch (proposal.state) {
        case PROPOSAL_STATES.VOTING:
          if (now > proposal.expiration.getTime()) {
            const forVotes = BigNumber.from(proposal.for);
            const againstVotes = BigNumber.from(proposal.against);
            const totalVotes = BigNumber.from(proposal.for).add(proposal.against);
            const newState = forVotes.gte(REQUIRE_WEIGHT) && forVotes.mul(100).div(totalVotes).gte(REQUIRE_PERCENTAGE)
              ? PROPOSAL_STATES.RESEARCH
              : PROPOSAL_STATES.REJECTED;
            console.log(proposal.id, forVotes.toNumber(), '+', againstVotes.toNumber(), '=', totalVotes.toNumber(), '=>', forVotes.mul(100).div(totalVotes).toNumber(), forVotes.mul(100).div(totalVotes).gte(REQUIRE_PERCENTAGE), forVotes.gte(REQUIRE_WEIGHT));
            return repository.updateById(proposal.id, { state: newState }, t);
          }
          break;

        case PROPOSAL_STATES.RESEARCH:
          // do nothing
          break;

        case PROPOSAL_STATES.FUNDING:
          // check due date & fund raised
          if (proposal.raised_fund >= proposal.target_fund) {
            console.log('funded', proposal.raised_fund);
            return repository.updateById(proposal.id, { state: PROPOSAL_STATES.IMPLEMENTATION }, t);
          }
          break;

        case PROPOSAL_STATES.IMPLEMENTATION:
          // do nothing
          break;
      }
    })
  )
    .then(() => t.commit())
    .catch((err) => {
      logger.error("Unexpected error when updating proposals: %O", err);
      return t.rollback();
    });
};

module.exports = {
  findAllByPage,
  save,
  updateStates,
};
