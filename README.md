# Tram journeys

A browser experiment for the two-session tram study. It runs entirely in the browser (HTML, CSS, JavaScript, no server code), so it can be hosted on GitHub Pages. The participant's results are downloaded as a CSV file at the end.

## What participants do

| Session | Phase 1: delay practice | Phase 2: city tram |
| --- | --- | --- |
| 1 | Practice line, map always on screen, 21 trials with tram delays, feedback. Fewer than 15 correct ends the session. | Main map, 63 trials (every journey once, plus one more presentation of each pair of stations in a random direction, all shuffled), both trams at the origin, feedback. The map can be opened at the start and between trials, not during them. 15 or more correct on the 21 scored trials passes. |
| 2 | As in session 1, without a pass mark. | Main map, 42 trials with tram delays, no feedback, no map. 27 or more correct enters the prize draw. |

A session-1 phase-2 trial is scored only the first time its pair of stations appears; the later presentations of that pair are practice.

## Run it locally

Open a terminal in this folder and run `python3 -m http.server`, then visit <http://localhost:8000>. Opening `index.html` directly also works in most browsers.

## Put it on GitHub Pages

1. Create a repository on GitHub and upload the contents of this folder (keep the folder structure).
2. In the repository, go to **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. After a minute the experiment is live at `https://<your-user-name>.github.io/<repository-name>/`.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The page and its screens |
| `css/style.css` | The look (colours are at the top) |
| `js/config.js` | Station names, map files, trial counts, pass marks and every instruction text |
| `js/trial-generator.js` | Trial generation, including the mock-up to replace |
| `js/experiment.js` | The flow, the map button and its timing, scoring and the CSV |
| `images/practice-map.png`, `images/main-map.png` | Placeholder maps: replace with the real ones |

## Replace the maps

Save the real maps as `images/practice-map.png` and `images/main-map.png` (or change the paths in `js/config.js`). The station lists in `js/config.js` must run in **clockwise** order, matching the maps: the code numbers stations 0 to 6 by their position in those lists.

## Replace the mock-up trial generator

`js/trial-generator.js` contains two mock-up functions used for every block with tram delays: the delay practice in both sessions and the session-2 city tram. Replace their bodies with the real generator and keep their inputs and outputs:

```js
initTramDelayTask({ task, session, numStations, numTrials })
// Called once at the start of a block.
//   task:    'practice' (delay practice on the colour line, both sessions)
//            or 'main' (main task with delays on the city line, session 2)
//   session: 1 or 2
// Use Math.random() for any randomness.

getTramDelayTrial(trialNumber)   // trialNumber runs from 1 to numTrials
// returns { origin, destination, cwTram, ccwTram }
//   origin, destination: station numbers 0-6, different from each other
//   cwTram, ccwTram:     how many stops away each tram is, 0-6 (0 is shown as "at <origin>")
```

The experiment works out the correct answer itself and stops with a clear message if a trial is invalid or a tie. The session-1 city tram (no delays) is already implemented in `buildMapTaskTrialsWithoutDelays()`.

## Test run

Tick **Test run** on the start page to try the experiment quickly: each part shows only its first 2 questions, the pass marks are not applied (so every part is shown), a "Test run" badge stays in the top bar, and the results file is named `TEST_tram_...csv` with `test_run` = 1. The trial functions still build full blocks; the test run just stops early.

## Randomisation

Trials are drawn with JavaScript's `Math.random()`, afresh every time a session starts. Nothing from session 1 is needed in session 2, so there is no seed; the participant code only labels the results. Every trial is recorded in full in the results file, so the file is the record of what each participant saw. If the page is reloaded mid-session, the participant starts again with new trials.

## The results file

One row per trial. The last columns repeat the session summary on every row.

| Column | Meaning |
| --- | --- |
| `participant_code`, `session` | As entered on the first screen |
| `phase`, `task` | 1 = `delay_practice`, 2 = `map_task` |
| `trial` | Trial number within the phase |
| `origin_index`, `origin`, `destination_index`, `destination` | The journey (index = clockwise position, 0-6) |
| `cw_tram_stops`, `ccw_tram_stops` | How many stops away each tram was |
| `cw_ride_stops`, `ccw_ride_stops` | Length of each ride |
| `cw_arrival`, `ccw_arrival` | Waiting plus riding, in stops |
| `correct_answer`, `response`, `correct` | `CW` or `CCW`; `correct` is 1 or 0 |
| `scored` | 1 if the trial counts towards the phase score |
| `pair_presentation` | 1 the first time this pair of stations appears in the phase, 2 the second time, and so on |
| `rt_ms` | Time from the trial appearing to the answer, in milliseconds |
| `feedback_shown` | 1 if feedback followed the answer |
| `map_view_ms_before_trial` | Session 1, phase 2: time the map was open since the previous trial (for trial 1: at the start of the phase) |
| `trial_started_at` | Clock time the trial appeared (ISO 8601, UTC) |
| `phase1_score`, `phase1_trials` | Practice score |
| `phase2_score`, `phase2_score_out_of` | City tram score (session 1: scored trials; session 2: all trials) |
| `phase2_correct_all_trials`, `phase2_trials` | City tram, all trials |
| `phase2_map_view_total_ms`, `phase2_map_views` | Total time the map was open in phase 2, and how often it was opened |
| `phase2_map_view_ms_after_last_trial` | Map time after the final trial (included in the total) |
| `outcome` | `passed`, `failed_practice`, `failed_map_task`, `prize_draw`, `no_prize_draw` or `test_run` |
| `test_run` | 1 if the session was a test run |
| `session_started_at`, `session_finished_at`, `app_version` | Housekeeping |

## Good to know

- **Download before closing.** The results only leave the browser through the download button. A backup is also kept in the browser's local storage under `tramJourneys:<code>:session<n>`, and the browser asks for confirmation before the page is closed with results not yet downloaded.
- **Internet connection.** Bootstrap and the Atkinson Hyperlegible font load from public CDNs. Without a connection the experiment still runs, with plain browser styling.
- **Double clicks.** Buttons ignore clicks for 0.3 s after they appear, so a double click cannot answer the next question or skip feedback.
- **Map timing** counts wall-clock time while the map is open, including time spent in another browser tab.
