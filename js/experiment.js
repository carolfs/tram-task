/*
 * Experiment flow: start screen, phase 1 (delay practice), phase 2 (city tram), results and CSV download.
 * Trials come from js/trial-generator.js; settings and wording from js/config.js.
 */
(function () {
  'use strict';

  const CONFIG = window.TRAM_CONFIG;
  const ANSWER_LOCK_MS = 300;   // buttons ignore clicks this soon after appearing (stops double clicks carrying over)
  const $ = (id) => document.getElementById(id);

  const state = {
    participantCode: '',
    session: 0,
    startedAt: '',
    finishedAt: '',
    rows: [],
    summary: {},
    running: false,
    testRun: false,
    downloaded: false
  };

  // ---------------------------------------------------------------- helpers

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('d-none', screen.id !== id));
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Enables `button` after a short lock, then resolves on its next click. */
  function waitForClick(button) {
    button.disabled = true;
    return new Promise((resolve) => {
      setTimeout(() => {
        button.disabled = false;
        button.addEventListener('click', () => resolve(), { once: true });
      }, ANSWER_LOCK_MS);
    });
  }

  /** Enables both answer buttons after a short lock; resolves with the answer and the click time. */
  function waitForAnswer() {
    const buttons = Array.from(document.querySelectorAll('.btn-answer'));
    return new Promise((resolve) => {
      const onClick = (event) => {
        const time = performance.now();
        buttons.forEach((b) => { b.disabled = true; b.removeEventListener('click', onClick); });
        event.currentTarget.classList.add('is-chosen');
        resolve({ answer: event.currentTarget.dataset.answer, time });
      };
      setTimeout(() => buttons.forEach((b) => { b.disabled = false; b.addEventListener('click', onClick); }), ANSWER_LOCK_MS);
    });
  }

  function stopsAway(stops, originName) {
    if (stops === 0) return 'at ' + originName;
    return stops === 1 ? '1 stop away' : stops + ' stops away';
  }

  function stopsWord(stops) {
    return stops === 1 ? '1 stop' : stops + ' stops';
  }

  function solveTrial(trial, numStations) {
    const cwRide = (trial.destination - trial.origin + numStations) % numStations;
    const ccwRide = numStations - cwRide;
    const cwArrival = trial.cwTram + cwRide;
    const ccwArrival = trial.ccwTram + ccwRide;
    const answer = cwArrival < ccwArrival ? 'CW' : (ccwArrival < cwArrival ? 'CCW' : 'TIE');
    return { cwRide, ccwRide, cwArrival, ccwArrival, answer };
  }

  /** Stops the experiment with a clear message if a trial function returns something unusable. */
  function checkTrial(trial, numStations, label) {
    const numbers = trial ? [trial.origin, trial.destination, trial.cwTram, trial.ccwTram] : [];
    const valid = numbers.length === 4 && numbers.every(Number.isInteger) &&
      trial.origin >= 0 && trial.origin < numStations &&
      trial.destination >= 0 && trial.destination < numStations && trial.origin !== trial.destination &&
      trial.cwTram >= 0 && trial.cwTram <= CONFIG.maxTramStops &&
      trial.ccwTram >= 0 && trial.ccwTram <= CONFIG.maxTramStops;
    if (!valid) throw new Error(label + ' is not a valid trial: ' + JSON.stringify(trial));
    if (solveTrial(trial, numStations).answer === 'TIE') {
      throw new Error(label + ' is a tie (both trams arrive together): ' + JSON.stringify(trial));
    }
  }

  // ---------------------------------------------------------------- map viewer

  /*
   * mode 'always': the map stays on screen (phase 1).
   * mode 'toggle': the participant opens and closes it with the button, which only works while `enabled`
   *                (phase 2 intro and between trials of session 1). Viewing time is measured.
   * mode 'none':   no map (session 2, phase 2).
   */
  const mapViewer = {
    mode: 'none',
    enabled: false,
    isOpen: false,
    openedAt: 0,
    pendingMs: 0,
    totalMs: 0,
    views: 0,

    setup(mode, line) {
      this.closeMap();
      this.mode = mode;
      this.enabled = false;
      this.pendingMs = 0;
      this.totalMs = 0;
      this.views = 0;
      if (line && mode !== 'none') {
        $('map-image').src = line.mapImage;
        $('map-image').alt = line.mapAlt;
      }
      this.render();
    },

    setEnabled(on) {
      this.enabled = on && this.mode === 'toggle';
      if (!this.enabled) this.closeMap();
      this.render();
    },

    toggle() {
      if (!this.enabled) return;
      if (this.isOpen) this.closeMap();
      else this.openMap();
    },

    openMap() {
      this.isOpen = true;
      this.openedAt = performance.now();
      this.views += 1;
      this.render();
    },

    closeMap() {
      if (!this.isOpen) return;
      const ms = performance.now() - this.openedAt;
      this.pendingMs += ms;
      this.totalMs += ms;
      this.isOpen = false;
      this.render();
    },

    /** Viewing time since the last call (i.e. since the previous trial), in whole milliseconds. */
    takePendingMs() {
      const ms = Math.round(this.pendingMs);
      this.pendingMs = 0;
      return ms;
    },

    render() {
      // The map area keeps its place while the map is closed, so nothing on the page moves when it opens.
      const hasPane = this.mode !== 'none';
      const showImage = this.mode === 'always' || this.isOpen;
      $('map-pane').classList.toggle('d-none', !hasPane);
      $('map-pane').classList.toggle('is-closed', !showImage);
      $('stage').classList.toggle('with-map', hasPane);
      $('map-controls').classList.toggle('d-none', this.mode !== 'toggle');
      $('map-image').classList.toggle('d-none', !showImage);
      $('map-placeholder').classList.toggle('d-none', showImage);
      const button = $('map-toggle');
      button.disabled = !this.enabled;
      button.setAttribute('aria-expanded', String(this.isOpen));
      $('map-toggle-label').textContent = this.isOpen ? 'Hide map' : 'Show map';
      $('map-note').textContent = !this.enabled
        ? 'The map is unavailable while you answer.'
        : (this.isOpen ? 'The map closes when the next question starts.' : 'You can look at the map now.');
    }
  };

  $('map-toggle').addEventListener('click', () => mapViewer.toggle());

  // Give the "map hidden" panel the same shape as the map image.
  $('map-image').addEventListener('load', (event) => {
    const img = event.target;
    if (img.naturalWidth && img.naturalHeight) {
      $('map-frame').style.setProperty('--map-ratio', img.naturalWidth + ' / ' + img.naturalHeight);
    }
  });

  // ---------------------------------------------------------------- blocks

  /** task: 'practice' or 'main'. A test run builds the whole block, then keeps only its first trials. */
  function delayTrials(task, numStations, numTrials) {
    initTramDelayTask({ task, session: state.session, numStations, numTrials });
    const label = task === 'practice' ? 'practice block' : 'main task';
    const trials = [];
    for (let trialNumber = 1; trialNumber <= numTrials; trialNumber++) {
      const trial = getTramDelayTrial(trialNumber);
      checkTrial(trial, numStations, 'Trial ' + trialNumber + ' of the ' + label);
      trials.push(Object.assign({}, trial, { scored: true }));
    }
    return trials;
  }

  function forTestRun(trials) {
    return state.testRun ? trials.slice(0, CONFIG.testRunTrials) : trials;
  }

  function practiceBlock() {
    const line = CONFIG.practice;
    return {
      phase: 1,
      task: 'delay_practice',
      partName: 'Part 1 of 2',
      progressName: 'Practice',
      line,
      trials: forTestRun(delayTrials('practice', line.stations.length, line.trials)),
      hasDelays: true,
      feedback: true,
      mapMode: 'always',
      text: CONFIG.text['session' + state.session].phase1
    };
  }

  function mapTaskBlock() {
    const line = CONFIG.main;
    const numStations = line.stations.length;
    const firstSession = state.session === 1;
    let trials;
    if (firstSession) {
      trials = buildMapTaskTrialsWithoutDelays(numStations);
      trials.forEach((t, i) => checkTrial(t, numStations, 'Trial ' + (i + 1) + ' of the main task'));
    } else {
      trials = delayTrials('main', numStations, line.trialsSession2);
    }
    trials = forTestRun(trials);
    return {
      phase: 2,
      task: 'map_task',
      partName: 'Part 2 of 2',
      progressName: 'City tram',
      line,
      trials,
      hasDelays: !firstSession,
      feedback: firstSession,
      mapMode: firstSession ? 'toggle' : 'none',
      text: CONFIG.text['session' + state.session].phase2
    };
  }

  function setProgress(block, trialIndex) {
    if (!block) {
      $('progress-label').textContent = '';
      $('track-fill').style.width = '0%';
      return;
    }
    const total = block.trials.length;
    $('progress-label').textContent = trialIndex < 0
      ? block.progressName + ', ' + total + ' questions'
      : block.progressName + ', question ' + (trialIndex + 1) + ' of ' + total;
    $('track-fill').style.width = (100 * Math.max(trialIndex, 0) / total) + '%';
  }

  function renderTrial(block, trial) {
    const names = block.line.stations;
    $('trial-view').classList.remove('is-leaving');
    $('feedback-view').classList.add('d-none');
    document.querySelector('.question').classList.remove('d-none');
    document.querySelector('.answers').classList.remove('d-none');
    document.querySelectorAll('.btn-answer').forEach((b) => { b.disabled = true; b.classList.remove('is-chosen'); });

    $('origin-name').textContent = names[trial.origin];
    $('destination-name').textContent = names[trial.destination];
    $('departures').classList.toggle('d-none', !block.hasDelays);
    $('both-waiting').classList.toggle('d-none', block.hasDelays);
    if (block.hasDelays) {
      $('cw-when').textContent = stopsAway(trial.cwTram, names[trial.origin]);
      $('ccw-when').textContent = stopsAway(trial.ccwTram, names[trial.origin]);
    } else {
      $('both-waiting').textContent = 'Both trams are waiting at ' + names[trial.origin] + '.';
    }
  }

  function renderFeedback(block, trial, solution, response, correct, isLast) {
    document.querySelector('.question').classList.add('d-none');
    document.querySelector('.answers').classList.add('d-none');

    const chosen = response === 'CW' ? 'clockwise' : 'anticlockwise';
    const verdict = $('feedback-verdict');
    verdict.className = 'verdict ' + (correct ? 'is-correct' : 'is-wrong');
    verdict.innerHTML = correct
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>Correct'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>Not quite';
    verdict.insertAdjacentHTML('beforeend', '<span class="verdict-choice">You chose ' + chosen + '.</span>');

    $('working-caption').textContent = block.hasDelays ? 'Stops waiting + stops riding' : 'Stops riding';
    $('work-cw-sum').textContent = block.hasDelays
      ? trial.cwTram + ' + ' + solution.cwRide + ' = ' + stopsWord(solution.cwArrival)
      : stopsWord(solution.cwRide);
    $('work-ccw-sum').textContent = block.hasDelays
      ? trial.ccwTram + ' + ' + solution.ccwRide + ' = ' + stopsWord(solution.ccwArrival)
      : stopsWord(solution.ccwRide);
    $('work-cw').classList.toggle('is-first', solution.answer === 'CW');
    $('work-ccw').classList.toggle('is-first', solution.answer === 'CCW');

    const winner = solution.answer === 'CW' ? 'clockwise' : 'anticlockwise';
    $('feedback-summary').textContent = block.hasDelays
      ? 'The ' + winner + ' tram gets you there first.'
      : 'Going ' + winner + ' is shorter.';
    $('next-button').textContent = isLast ? 'Continue' : 'Next question';
    $('feedback-view').classList.remove('d-none');
    $('feedback-view').scrollIntoView({ block: 'nearest' });
  }

  async function runBlock(block) {
    const names = block.line.stations;
    const numStations = names.length;
    mapViewer.setup(block.mapMode, block.line);

    $('intro-part').textContent = block.partName;
    $('intro-title').textContent = block.text.title;
    $('intro-body').innerHTML = block.text.body;
    $('intro-start').textContent = block.text.start;
    setProgress(block, -1);
    showScreen('screen-intro');
    window.scrollTo(0, 0);
    mapViewer.setEnabled(true);          // only has an effect in 'toggle' mode
    await waitForClick($('intro-start'));

    const result = { correct: 0, scoredCorrect: 0, scoredTrials: 0, trials: block.trials.length };
    const pairCounts = new Map();        // how often each pair of stations has appeared in this phase
    for (let i = 0; i < block.trials.length; i++) {
      const trial = block.trials[i];
      const pairKey = Math.min(trial.origin, trial.destination) + '-' + Math.max(trial.origin, trial.destination);
      const pairPresentation = (pairCounts.get(pairKey) || 0) + 1;
      pairCounts.set(pairKey, pairPresentation);
      mapViewer.setEnabled(false);       // closes the map and banks its viewing time
      const mapMsBefore = block.mapMode === 'toggle' ? mapViewer.takePendingMs() : '';
      const solution = solveTrial(trial, numStations);

      renderTrial(block, trial);
      setProgress(block, i);
      showScreen('screen-task');
      const startedAt = new Date().toISOString();
      await nextFrame();
      const shownAt = performance.now();
      const response = await waitForAnswer();
      const correct = response.answer === solution.answer;

      result.correct += correct ? 1 : 0;
      if (trial.scored) {
        result.scoredTrials += 1;
        result.scoredCorrect += correct ? 1 : 0;
      }
      state.rows.push({
        participant_code: state.participantCode,
        session: state.session,
        phase: block.phase,
        task: block.task,
        trial: i + 1,
        origin_index: trial.origin,
        origin: names[trial.origin],
        destination_index: trial.destination,
        destination: names[trial.destination],
        cw_tram_stops: trial.cwTram,
        ccw_tram_stops: trial.ccwTram,
        cw_ride_stops: solution.cwRide,
        ccw_ride_stops: solution.ccwRide,
        cw_arrival: solution.cwArrival,
        ccw_arrival: solution.ccwArrival,
        correct_answer: solution.answer,
        response: response.answer,
        correct: correct ? 1 : 0,
        scored: trial.scored ? 1 : 0,
        pair_presentation: pairPresentation,
        rt_ms: Math.round(response.time - shownAt),
        feedback_shown: block.feedback ? 1 : 0,
        map_view_ms_before_trial: mapMsBefore,
        trial_started_at: startedAt
      });
      saveBackup();

      if (block.feedback) {
        renderFeedback(block, trial, solution, response.answer, correct, i === block.trials.length - 1);
        mapViewer.setEnabled(true);
        await waitForClick($('next-button'));
      } else {
        $('trial-view').classList.add('is-leaving');
        await sleep(CONFIG.pauseBetweenTrialsMs);
      }
    }

    mapViewer.setEnabled(false);
    result.mapViewMsAfterLastTrial = block.mapMode === 'toggle' ? mapViewer.takePendingMs() : '';
    result.mapViewTotalMs = block.mapMode === 'toggle' ? Math.round(mapViewer.totalMs) : '';
    result.mapViews = block.mapMode === 'toggle' ? mapViewer.views : '';
    return result;
  }

  // ---------------------------------------------------------------- session

  async function runSession() {
    state.running = true;
    state.startedAt = new Date().toISOString();
    state.summary = {
      phase1_score: '', phase1_trials: '', phase2_score: '', phase2_score_out_of: '',
      phase2_correct_all_trials: '', phase2_trials: '', phase2_map_view_total_ms: '',
      phase2_map_views: '', phase2_map_view_ms_after_last_trial: ''
    };

    const practice = await runBlock(practiceBlock());
    state.summary.phase1_score = practice.correct;
    state.summary.phase1_trials = practice.trials;
    // A test run has too few trials for the pass marks, so it always goes on to the next phase.
    if (state.session === 1 && !state.testRun && practice.correct < CONFIG.passMarks.practice) return finish('failed_practice');

    const mapTask = await runBlock(mapTaskBlock());
    Object.assign(state.summary, {
      phase2_score: state.session === 1 ? mapTask.scoredCorrect : mapTask.correct,
      phase2_score_out_of: state.session === 1 ? mapTask.scoredTrials : mapTask.trials,
      phase2_correct_all_trials: mapTask.correct,
      phase2_trials: mapTask.trials,
      phase2_map_view_total_ms: mapTask.mapViewTotalMs,
      phase2_map_views: mapTask.mapViews,
      phase2_map_view_ms_after_last_trial: mapTask.mapViewMsAfterLastTrial
    });
    if (state.testRun) return finish('test_run');
    if (state.session === 1) {
      return finish(mapTask.scoredCorrect >= CONFIG.passMarks.mapTask ? 'passed' : 'failed_map_task');
    }
    return finish(mapTask.correct >= CONFIG.passMarks.prizeDraw ? 'prize_draw' : 'no_prize_draw');
  }

  function sessionColumns(outcome) {
    return Object.assign({}, state.summary, {
      outcome,
      test_run: state.testRun ? 1 : 0,
      session_started_at: state.startedAt,
      session_finished_at: state.finishedAt,
      app_version: CONFIG.appVersion
    });
  }

  function finish(outcome) {
    state.finishedAt = new Date().toISOString();
    const extra = sessionColumns(outcome);
    state.rows.forEach((row) => Object.assign(row, extra));
    state.running = false;
    saveBackup();

    mapViewer.setup('none');
    setProgress(null);
    $('track-fill').style.width = '100%';

    const messages = {
      passed: CONFIG.text.results.passed,
      failed_practice: CONFIG.text.results.failedPractice,
      failed_map_task: CONFIG.text.results.failedMapTask,
      prize_draw: CONFIG.text.results.prizeDraw,
      no_prize_draw: CONFIG.text.results.noPrizeDraw,
      test_run: CONFIG.text.results.testRun
    };
    $('results-message').textContent = messages[outcome];

    const s = state.summary;
    let scores = '<div class="score"><dt>Practice</dt><dd>' + s.phase1_score + ' of ' + s.phase1_trials + '</dd></div>';
    if (s.phase2_trials !== '') {
      scores += '<div class="score"><dt>City tram</dt><dd>' + s.phase2_score + ' of ' + s.phase2_score_out_of + '</dd></div>';
      if (state.session === 1) {
        scores += '<p class="score-note">Scored questions are the first time each pair of stations appeared. ' +
                  'All answers: ' + s.phase2_correct_all_trials + ' of ' + s.phase2_trials + '.</p>';
      }
    }
    $('results-scores').innerHTML = scores;
    showScreen('screen-results');
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- saving

  function backupKey() {
    return 'tramJourneys:' + state.participantCode + ':session' + state.session + (state.testRun ? ':test' : '');
  }

  function saveBackup() {
    try {
      localStorage.setItem(backupKey(), JSON.stringify({ savedAt: new Date().toISOString(), rows: state.rows }));
    } catch (error) {
      // Storage can be full or blocked (private windows). The download still works.
    }
  }

  function csvCell(value) {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function toCsv(rows) {
    if (!rows.length) return '';
    const columns = Object.keys(rows[0]);
    const lines = [columns.join(',')];
    rows.forEach((row) => lines.push(columns.map((c) => csvCell(row[c])).join(',')));
    return lines.join('\r\n') + '\r\n';
  }

  function downloadCsv() {
    const stamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
    const fileName = (state.testRun ? 'TEST_' : '') + 'tram_' + state.participantCode + '_session' + state.session + '_' + stamp + '.csv';
    const blob = new Blob([toCsv(state.rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    state.downloaded = true;
  }

  $('download-button').addEventListener('click', downloadCsv);
  $('error-download-button').addEventListener('click', downloadCsv);

  window.addEventListener('beforeunload', (event) => {
    if (state.running || (state.rows.length && !state.downloaded)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  // ---------------------------------------------------------------- back to the start

  const NOT_DOWNLOADED_WARNING =
    'The results of this session have not been downloaded. If you go back to the start page, ' +
    'you will no longer be able to download them from this page.\n\nGo back to the start page anyway?';

  /** Clears the finished session and shows the start page, ready for the next participant. */
  function backToStart(event) {
    event.preventDefault();
    if (state.rows.length && !state.downloaded && !window.confirm(NOT_DOWNLOADED_WARNING)) return;
    Object.assign(state, {
      participantCode: '', session: 0, startedAt: '', finishedAt: '', rows: [], summary: {},
      running: false, testRun: false, downloaded: false
    });
    mapViewer.setup('none');
    setProgress(null);
    $('test-badge').classList.add('d-none');
    $('start-form').reset();             // empty code, no session chosen, test run off
    showStartError('');
    showScreen('screen-start');
    window.scrollTo(0, 0);
    $('participant-code').focus();
  }

  document.querySelectorAll('.restart-link').forEach((link) => link.addEventListener('click', backToStart));

  // ---------------------------------------------------------------- start

  function showStartError(message) {
    $('start-error').textContent = message;
  }

  function showFatalError(error) {
    console.error(error);
    state.running = false;
    mapViewer.setup('none');
    setProgress(null);
    $('error-message').textContent = error.message;
    $('error-download-button').classList.toggle('d-none', state.rows.length === 0);
    showScreen('screen-error');
  }

  $('start-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const code = $('participant-code').value.trim().toUpperCase();
    const sessionInput = document.querySelector('input[name="session"]:checked');
    if (!/^[A-Z0-9]+$/.test(code)) return showStartError('Enter a participant code using letters and numbers only.');
    if (!sessionInput) return showStartError('Choose session 1 or session 2.');
    showStartError('');
    state.participantCode = code;
    state.session = Number(sessionInput.value);
    state.testRun = $('test-run').checked;
    $('test-badge').classList.toggle('d-none', !state.testRun);
    runSession().catch(showFatalError);
  });

  $('participant-code').addEventListener('input', (event) => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
})();
