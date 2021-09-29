"use strict";
const { UniqueConstraintError } = require("sequelize");
const createError = require("http-errors");

const { funds } = require("../models");

module.exports.save = (fields, transaction) => {
  return funds.create(fields, transaction).catch((e) => {
    // if (e instanceof UniqueConstraintError) {
    //   throw createError(400, "You've already voted");
    // } else
    throw e;
  });
};

module.exports.findAll = () => funds.findAll();

module.exports.findById = (id, transaction, lock = false) => {
  return funds.findOne({ where: { id } }, transaction, lock);
};

module.exports.updateById = (id, fields, transaction) => {
  return funds.update(fields, {
    where: {
      id,
    },
    transaction,
  });
};

