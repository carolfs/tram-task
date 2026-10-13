/*
 * Trial generation.
 *
 * Stations are numbered 0, 1, 2 ... in clockwise order (see js/config.js).
 * A trial is an object:
 *   { origin, destination, cwTram, ccwTram }
 *   origin, destination   station numbers (different from each other)
 *   cwTram, ccwTram       how many stops away the clockwise / anticlockwise tram is (1 to 6)
 * The experiment works out the correct answer itself, so a generator only has to supply these four numbers
 * and must never produce a tie (both trams arriving together).
 *
 * Randomness comes from Math.random(). Nothing carries over between sessions, so no seed is needed: every
 * run draws fresh trials, and the results file records each trial in full.
 */

const CONFIG = window.TRAM_CONFIG;

/** Shuffles an array in place (Fisher-Yates). */
function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Session 1, phase 2, with both trams at the origin: every journey on the map once (42 for 7 stations), plus
 * one more presentation of every pair of stations in a random direction (21 more), all shuffled: 63 trials.
 * A trial is scored only the first time its pair of stations appears, which gives 21 scored trials.
 */
function buildMapTaskTrialsWithoutDelays(numStations) {
  const trials = [];
  for (let origin = 0; origin < numStations; origin++) {
    for (let destination = 0; destination < numStations; destination++) {
      if (origin !== destination) trials.push({ origin, destination, cwTram: 0, ccwTram: 0 });
    }
  }
  for (let a = 0; a < numStations; a++) {
    for (let b = a + 1; b < numStations; b++) {
      const forward = Math.random() < 0.5;
      trials.push({ origin: forward ? a : b, destination: forward ? b : a, cwTram: 0, ccwTram: 0 });
    }
  }
  shuffleInPlace(trials);
  const seenPairs = new Set();
  for (const trial of trials) {
    const pair = Math.min(trial.origin, trial.destination) + '-' + Math.max(trial.origin, trial.destination);
    trial.scored = !seenPairs.has(pair);
    seenPairs.add(pair);
  }
  return trials;
}

let tramDelayTrials = [];

/**
 * Prepares the trials for one block with tram delays. Called once at the start of the block.
 * @param {Object}   options
 * @param {string}   options.task         'practice' (delay practice, colour line, both sessions)
 *                                        or 'main' (main task with delays on the city line, session 2)
 * @param {number}   options.session      1 or 2
 * @param {number}   options.numStations  stations on the line (7)
 * @param {number}   options.numTrials    trials in the block (21 for practice, 42 for the main task)
 */
function initTramDelayTask({ task, session, numStations, numTrials }) {
  tramDelayTrials = [];
  let origin = 0;
  let destination = 1;
  let cwTram = 0;
  let ccwTram = 0;
  let diff2Delay = Array(numStations).fill(2).concat(
    Array(numStations).fill(4));
  shuffleInPlace(diff2Delay);
  let diff2Trials = 0;
  while (tramDelayTrials.length < numTrials) {
    const cwdist = (destination - origin + numStations) % numStations;
    const ccwdist = (origin - destination + numStations) % numStations;
    const diff = Math.min(cwdist, ccwdist);
    let delayshort = 0;
    if (diff == 1) {
      delayshort = Math.random() < .5 ? 3 : 4;
    }
    else if (diff == 2) {
      delayshort = diff2Delay[diff2Trials];
      diff2Trials += 1;
    }
    else {
      delayshort = Math.random() < .5 ? 2 : 3;
    }
    if (cwdist < ccwdist) {
      cwTram = delayshort;
      ccwTram = Math.floor(Math.random() *
        (CONFIG.maxTramStops - cwTram)) + 1;
      cwTram += ccwTram;
    }
    else {
      ccwTram = delayshort;
      cwTram = Math.floor(Math.random() *
        (CONFIG.maxTramStops - ccwTram)) + 1;
      ccwTram += cwTram;
    }
    if (task == 'practice') {
      if (origin < destination) {
        if (Math.random() < 0.5) {
          tramDelayTrials.push({ origin, destination, cwTram, ccwTram });
        }
        else {
          tramDelayTrials.push({
            origin: destination,
            destination: origin,
            cwTram: ccwTram,
            ccwTram: cwTram
          });
        }
      }
    }
    else {
      tramDelayTrials.push({ origin, destination, cwTram, ccwTram });
    }
    destination = (destination + 1) % numStations;
    if (destination == origin) {
      origin = (origin + 1) % numStations;
      destination = (origin + 1) % numStations;
    }
  }
  shuffleInPlace(tramDelayTrials);
}

/**
 * Returns one trial of the block prepared by initTramDelayTask().
 * @param {number} trialNumber  1 for the first trial, up to numTrials
 * @returns {{origin: number, destination: number, cwTram: number, ccwTram: number}}
 */
function getTramDelayTrial(trialNumber) {
  return Object.assign({}, tramDelayTrials[trialNumber - 1]);
}
