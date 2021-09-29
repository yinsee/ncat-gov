"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = {
  model: (sequelize) => {
    class Fund extends Model { }
    Fund.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        funderAddress: {
          type: DataTypes.STRING,
          allowNull: false,
          references: {
            model: "users",
            key: "address",
          },
        },
        proposalId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "proposals",
            key: "id",
          },
        },
        amount: {
          type: DataTypes.DOUBLE,
          allowNull: false,
        },
      },
      { sequelize, modelName: "funds" }
    );
    return Fund;
  },
};
