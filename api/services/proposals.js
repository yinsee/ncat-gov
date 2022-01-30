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
        `You should own at least ${MIN_PROPOSAL_BALANCE.div(10 ** DECIMALS).toString()} NCAT to create a proposal`
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

const update = async (address, proposalId, accepted) => {

  // validate transaction
  let user;
  try {
    user = await usersRepository.findByAddress(address, null, true);
    if (!user || !user.isAdmin) {
      throw 'Invalid user';
    }
  } catch (error) {
    throw error;
  }

  let t = await sequelize.transaction();
  try {
    const proposal = await repository.findById(proposalId, t, true);
    if (proposal.state != PROPOSAL_STATES.RESEARCH && proposal.state != PROPOSAL_STATES.IMPLEMENTATION) {
      throw `Cannot change when state is ${proposal.state}`;
    }

    // determine the new state
    let newstate;
    if (!accepted) {
      newstate = PROPOSAL_STATES.REJECTED;
    }
    else {
      if (proposal.state == PROPOSAL_STATES.IMPLEMENTATION) {
        newstate = PROPOSAL_STATES.COMPLETED;
      }
      else if (proposal.state == PROPOSAL_STATES.RESEARCH) {
        newstate = proposal.require_fund ? PROPOSAL_STATES.FUNDING : PROPOSAL_STATES.IMPLEMENTATION;
      }
    }
    if (!newstate) throw 'Undetermined new state';
    console.log('State change', accepted, proposal.state, '=>', newstate);

    await repository.updateById(
      proposalId,
      {
        state: newstate,
      },
      t
    );
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  return await repository.findById(proposalId, null, false);
};

const updateStates = async (app) => {
  const proposals = (await repository.findAllWhere({
    state: {
      [Op.notIn]: [
        PROPOSAL_STATES.COMPLETED,
        PROPOSAL_STATES.REJECTED,
      ]
    }
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

      let expired = (proposal.has_expire && now > proposal.expire_date.getTime());

      switch (proposal.state) {
        case PROPOSAL_STATES.VOTING:
          if (now > proposal.expiration.getTime() || expired) {
            const forVotes = BigNumber.from(proposal.for);
            const againstVotes = BigNumber.from(proposal.against);
            const totalVotes = BigNumber.from(proposal.for).add(proposal.against);
            const newState = forVotes.gte(REQUIRE_WEIGHT) && forVotes.mul(100).div(totalVotes).gte(REQUIRE_PERCENTAGE)
              ? PROPOSAL_STATES.RESEARCH
              : PROPOSAL_STATES.REJECTED;
            console.log(proposal.id, forVotes.toNumber(), '+', againstVotes.toNumber(), '=', totalVotes.toNumber(), '=>', forVotes.mul(100).div(totalVotes).toNumber(), forVotes.mul(100).div(totalVotes).gte(REQUIRE_PERCENTAGE), forVotes.gte(REQUIRE_WEIGHT));

            proposal.state = newState;
            app.io.emit('proposal', proposal);

            return repository.updateById(proposal.id, { state: newState }, t);
          }
          break;

        case PROPOSAL_STATES.RESEARCH:
          // do nothing
          break;

        case PROPOSAL_STATES.FUNDING:
          // check due date & fund raised
          if (Number(proposal.raised_fund) >= (Number(proposal.target_fund))) {
            console.log('funded', proposal.raised_fund);

            proposal.state = PROPOSAL_STATES.IMPLEMENTATION;
            app.io.emit('proposal', proposal);

            return repository.updateById(proposal.id, { state: PROPOSAL_STATES.IMPLEMENTATION }, t);
          }
          break;

        case PROPOSAL_STATES.IMPLEMENTATION:
          // do nothing
          break;
      }


      if (expired) {
        console.log('expired', proposal.expire_date);

        proposal.state = PROPOSAL_STATES.REJECTED;
        app.io.emit('proposal', proposal);

        return repository.updateById(proposal.id, { state: PROPOSAL_STATES.REJECTED }, t);
      }
    })
  )
    .then(() => {
      t.commit();
    })
    .catch((err) => {
      logger.error("Unexpected error when updating proposals: %O", err);
      return t.rollback();
    });
};

module.exports = {
  findAllByPage,
  save,
  update,
  updateStates,
};
