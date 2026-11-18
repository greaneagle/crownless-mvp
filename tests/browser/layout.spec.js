// Flow 9: responsive layout at desktop size and on a landscape phone (812×375). On each key screen the
// controls are inside the viewport, don't overlap, and on touch are at least 44×44 CSS px
// (expectLayoutSound, which W-01 reuses at every text size) (W-00).
const { test, open, waitMode, press, newGame, toMap, debug, expectLayoutSound } = require('./helpers');

const TOP_RIGHT_MAP = ['#waitBtn', '#partyBtn', '#journalBtn', '#settingsBtn'];
const BATTLE_CONTROLS = ['#joystick', '#mapBtn', '#ordersBtn', '#blockBtn', '#attackBtn', '#pauseBtn', '#settingsBtn'];

test('title screen', async ({ page }) => {
  await open(page);
  await expectLayoutSound(page, ['#primaryBtn', '#titleSavesBtn', '#titleHelpBtn', '#titleSettingsBtn']);
});

test('settlement menu', async ({ page }) => {
  await open(page);
  await newGame(page);
  // The menu scrolls inside itself on a phone: every button can be scrolled to and fits; the bottom row
  // (Leave, Walk the streets), shown together, doesn't overlap.
  await expectLayoutSound(page, ['#primaryBtn', '#secondaryBtn']);
  await expectLayoutSound(page, ['#recruitA', '#recruitB', '#buyFoodA', '#contractsBtn', '#accountsBtn', '#tradeBtn', '#restBtn', '#gearBtn', '#placeJournalBtn', '#savesBtn'], { scrolled: true });
});

test('world map, with the message line showing', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await press(page, '#waitBtn'); // "Waiting… time passes." on the message line
  await expectLayoutSound(page, TOP_RIGHT_MAP, { info: ['#topLeft', '#message'] });
});

test('battle on a large field', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  await expectLayoutSound(page, BATTLE_CONTROLS, { info: ['#topLeft'] });
});

test('battle with the Orders panel open: its buttons, the close button and the controls stay clear', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  await press(page, '#ordersBtn');
  await expectLayoutSound(page, [
    '#joystick',
    '#blockBtn',
    '#attackBtn',
    '#pauseBtn',
    '#settingsBtn',
    '#closeOrders',
    '#ordersPanel [data-group="infantry"]',
    '#ordersPanel [data-order="hold"]',
  ]);
});
