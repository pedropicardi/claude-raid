'use strict';

const { runChecks, runSetup } = require('./setup');
const { banner, header } = require('./ui');

function diagnose(opts) {
  return runChecks(opts);
}

async function run() {
  const { referenceCard } = require('./ui');

  console.log('\n' + banner());
  console.log(header('Diagnosing Wounds...') + '\n');

  const result = await runSetup();

  if (!result.allOk && !process.stdin.isTTY) {
    process.exitCode = 1;
  }

  console.log('\n' + referenceCard() + '\n');
}

module.exports = { diagnose, run };
