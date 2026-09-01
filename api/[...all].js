'use strict';

/** Catch-all serverless route: forwards every /api/* path to the Express app. */

const app = require('../server/index');

module.exports = app;
