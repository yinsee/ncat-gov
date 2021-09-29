"use strict";
const { Model, DataTypes } = require("sequelize");
const { BigNumber } = require("ethers");
const config = require("config");
const DECIMALS = config.get("blockchain.ncat.decimals");

const PROPOSAL_STATES = {
  VOTING: "Voting",
  RESEARCH: "Research",
  FUNDING: "Funding",
  IMPLEMENTATION: "Implementation",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

const PROPOSAL_EXPIRATION_PERIOD = 1000 * 60 * 60 * 24 * 7; // 1 week
const ZERO_BN = BigNumber.from(0);
const REQUIRE_PERCENTAGE = BigNumber.from(70); // 75% needed to pass
const REQUIRE_WEIGHT = BigNumber.from(150 * 10 ** 9); // 150B needed to pass

module.exports = {
  PROPOSAL_STATES,
  PROPOSAL_EXPIRATION_PERIOD,
  REQUIRE_PERCENTAGE,
  REQUIRE_WEIGHT,
  model: (sequelize) => {
    class Proposal extends Model { }

    Proposal.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: "compositeIndex",
        },
        author: {
          type: DataTypes.STRING,
          allowNull: false,
          references: {
            model: "users",
            key: "address",
          },
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        state: {
          type: DataTypes.ENUM({ values: Object.values(PROPOSAL_STATES) }),
          defaultValue: PROPOSAL_STATES.VOTING,
        },
        expiration: {
          type: DataTypes.DATE,
          defaultValue: () => new Date(
            new Date().getTime() + PROPOSAL_EXPIRATION_PERIOD
          ),
        },
        voters: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          defaultValue: [],
        },
        for: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ZERO_BN.toHexString(),
        },
        against: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ZERO_BN.toHexString(),
        },

        contact: { type: DataTypes.STRING, allowNull: true },
        contact_type: { type: DataTypes.STRING, allowNull: true },

        has_expire: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        expire_date: { type: DataTypes.DATE, allowNull: true },

        target_fund: { type: DataTypes.BIGINT, allowNull: true, defaultValue: 0 },
        require_fund: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        raised_fund: { type: DataTypes.DOUBLE, allowNull: true, defaultValue: 0 },
        funders: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          defaultValue: [],
        },
        fund_wallet_address: { type: DataTypes.STRING, allowNull: true },
      },
      { sequelize, modelName: "proposals" }
    );

    return Proposal;
  },
};
