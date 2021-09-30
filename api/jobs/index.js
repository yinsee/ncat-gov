"use strict";

const cron = require("node-cron");
const updateProposals = require("./update-proposals");

// Every hour
const everyHour = "* * * * *";

const jobs = {
  updateProposals: (app) => cron.schedule(everyHour, () => updateProposals(app)),
};

const start = (job, app) => {
  if (Object.hasOwnProperty.call(jobs, job)) {
    jobs[job](app).start();
  } else throw new Error("Unknown job");
};

const stop = (job) => {
  if (Object.hasOwnProperty.call(jobs, job)) {
    jobs[job]().stop();
  } else throw new Error("Unknown job");
};

module.exports = {
  startAll: (app) => {
    for (const job in jobs) {
      console.log('Starting job', job);
      start(job, app);
    }
  },
  stopAll: () => {
    for (const job in jobs) {
      stop(job);
    }
  },
  // start,
  // stop,
};
