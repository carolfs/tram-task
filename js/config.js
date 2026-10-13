/*
 * Settings for the tram experiment. Everything a researcher may want to change lives here.
 *
 * Station lists run in CLOCKWISE order and must match the order on the map images.
 * A station's position in its list (0, 1, 2 ...) is the number the trial functions use.
 */
window.TRAM_CONFIG = {
  appVersion: '1.0.0',

  // Phase 1: tram delay practice on the colour line (map always visible)
  practice: {
    stations: ['Red Station', 'Orange Station', 'Yellow Station', 'Green Station',
               'Blue Station', 'Purple Station', 'Pink Station'],
    mapImage: 'images/practice-map.png',
    mapAlt: 'Map of the practice tram line: seven colour-named stations on a loop',
    trials: 21
  },

  // Phase 2: the city tram (map only between trials in session 1, never in session 2)
  main: {
    stations: ['Central Station', 'Bank Station', 'Park Station', 'Beach Station',
               'Mall Station', 'Library Station', 'Main Street'],
    mapImage: 'images/main-map.png',
    mapAlt: 'Map of the city tram line: seven stations on a loop',
    trialsSession2: 42           // session 1 uses all 42 journeys plus one more of each pair: 63 trials
  },

  passMarks: {
    practice: 15,   // session 1, phase 1: fewer correct of 21 ends the session
    mapTask: 15,    // session 1, phase 2: correct answers on the 21 scored trials (first time each pair appears)
    prizeDraw: 27   // session 2, phase 2: correct of 42 enters the prize draw
  },

  testRunTrials: 2,         // trials per phase when "Test run" is ticked on the start page
  maxTramStops: 6,          // trams are 0 to 6 stops away (0 = at the origin)
  pauseBetweenTrialsMs: 600, // used when there is no feedback (session 2, phase 2)

  // Words shown to participants. HTML is allowed in "body".
  text: {
    session1: {
      phase1: {
        title: 'Practice: catch the first tram',
        body:
          '<p>You will travel between stations on the practice line. Its map stays on screen the whole time.</p>' +
          '<p>Two trams can take you: one goes clockwise, the other anticlockwise. Each may be a few stops away.</p>' +
          '<p>Every stop takes the same time, whether you are waiting for a tram or riding it. A tram that is 4 stops away and then rides 2 stops gets you there after 6 stops.</p>' +
          '<p>Choose the tram that gets you there first. After each answer you will see the working.</p>',
        start: 'Start practice'
      },
      phase2: {
        title: 'The city tram',
        body:
          '<p>Now you will travel on the city tram. Both trams are waiting at your station, so choose the way round with fewer stops.</p>' +
          '<p>The map is hidden while you answer. Open it with <strong>Show map</strong> before you start and between questions, as often as you like.</p>' +
          '<p>After each answer you will see whether you were right.</p>',
        start: 'Start'
      }
    },
    session2: {
      phase1: {
        title: 'Practice: a quick refresher',
        body:
          '<p>Before the main task, a short practice on the practice line. Its map stays on screen the whole time.</p>' +
          '<p>Every stop takes the same time, whether you are waiting for a tram or riding it. Choose the tram that gets you there first.</p>' +
          '<p>After each answer you will see the working.</p>',
        start: 'Start practice'
      },
      phase2: {
        title: 'The city tram, from memory',
        body:
          '<p>Now you will travel on the city tram again. This time the map is not available, so answer from memory.</p>' +
          '<p>As in the practice, each tram may be a few stops away. Choose the tram that gets you there first.</p>' +
          '<p>You will not see whether you were right. Just do your best.</p>',
        start: 'Start'
      }
    },
    results: {
      passed: 'Well done, you have earned your drink. Please let the researcher know you have finished.',
      failedPractice: 'Thank you for taking part. Please let the researcher know you have finished.',
      failedMapTask: 'Thank you for taking part. Please let the researcher know you have finished.',
      prizeDraw: 'Well done, you are entered into the £50 prize draw. Please let the researcher know you have finished.',
      noPrizeDraw: 'Thank you for taking part. Please let the researcher know you have finished.',
      testRun: 'Test run finished. The results file is marked as a test and pass marks were not applied.'
    }
  }
};
