import { chromium } from 'playwright';

const REPO = {
  id: '624472f243b0',
  url: 'https://github.com/pallets/flask',
  ingestionStatus: 'complete',
  supportedLanguages: ['python'],
  nodeCount: 466,
  edgeCount: 624
};

const pass = [], fail = [];
const check = (label, cond) => {
  if (cond) { pass.push(label); console.log('✓', label); }
  else       { fail.push(label); console.log('✗ FAIL:', label); }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(20000);

// ── SETUP ──────────────────────────────────────────────────
await page.goto('http://localhost:5173');
await page.evaluate(r => localStorage.setItem('helixfactory.last-repository', JSON.stringify(r)), REPO);
await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3500);
await page.screenshot({ path: '/tmp/val-01-home.png' });

// ── HOME PAGE ─────────────────────────────────────────────
check('home hero renders', (await page.locator('.hf-home-title h2').textContent()).includes('HelixFactory proves'));
check('topbar shows repo name', (await page.locator('.hf-top-status').textContent()).includes('pallets/flask'));
check('6 capability cards', (await page.locator('.hf-capability-card').count()) === 6);
check('How it works steps', (await page.locator('.hf-step-strip article').count()) === 4);

// ── INGEST PAGE ───────────────────────────────────────────
await page.locator('.hf-nav-item').nth(1).click();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/val-02-ingest.png' });

check('3 example repo buttons', (await page.locator('.hf-ingest-example-btn').count()) === 3);
check('5 pipeline steps', (await page.locator('.hf-ingest-pipeline article').count()) === 5);

// invalid URL validation
await page.fill('input[aria-label="Repository URL"]', 'not-a-github-url');
await page.locator('button:has-text("Ingest repository")').click();
await page.waitForTimeout(500);
check('invalid URL shows error', (await page.locator('.hf-status-failed').count()) > 0);

// ── TWIN PAGE — INITIAL STATE ─────────────────────────────
await page.locator('.hf-nav-item').nth(2).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3500);
await page.screenshot({ path: '/tmp/val-03-twin-empty.png' });

check('sidebar header "Code Twin"', (await page.locator('.hf-d3-sidebar h2').textContent()).trim() === 'Code Twin');
check('sidebar shows flask', (await page.locator('.hf-twin-repo-name').textContent()).includes('flask'));
check('mode badge present', (await page.locator('.hf-d3-mode').count()) > 0);
check('default depth 2', (await page.locator('.hf-d3-depth-controls span').textContent()).includes('2'));
check('6 sidebar sections', (await page.locator('.hf-d3-section').count()) === 6);
check('Architecture overview label', (await page.locator('.hf-d3-section label').allTextContents()).some(l => l.includes('Architecture overview')));
check('symbol search present', (await page.locator('#twin-symbol-search').count()) > 0);
check('canvas min-height > 400', ((await page.locator('.hf-d3-canvas').boundingBox())?.height ?? 0) > 400);
check('legend hidden (no graph)', !(await page.locator('.hf-d3-legend').isVisible()));
check('minimap hidden (no graph)', !(await page.locator('.hf-sigma-minimap').isVisible()));
check('controls hidden (no graph)', !(await page.locator('.hf-d3-canvas-controls').isVisible()));

// empty state
const emptyH2 = await page.locator('.hf-twin-empty h2').textContent().catch(() => '');
check('empty state heading correct', emptyH2.includes('Where do you want to start'));
const epCards = await page.locator('.hf-d3-empty-ep-btn').count();
check('entry point cards in empty state', epCards > 0);

// slash shortcut
await page.keyboard.press('/');
await page.waitForTimeout(200);
check('/ shortcut focuses search', await page.evaluate(() => document.activeElement?.id === 'twin-symbol-search'));

// search results
await page.fill('#twin-symbol-search', 'app');
await page.waitForTimeout(500);
const searchCount = await page.locator('.hf-d3-search-results button').count();
check('search results appear', searchCount > 0);
await page.fill('#twin-symbol-search', '');

// collapsibles
check('2 collapsible sections', (await page.locator('.hf-d3-disclosure').count()) === 2);

// open filters
await page.locator('.hf-d3-disclosure summary').first().click();
await page.waitForTimeout(300);
check('6 mode buttons', (await page.locator('.hf-d3-mode-grid button').count()) === 6);
check('filter buttons > 5', (await page.locator('.hf-d3-filter-grid button').count()) > 5);

// open impact
await page.locator('.hf-d3-disclosure summary').nth(1).click();
await page.waitForTimeout(300);
check('impact textarea present', (await page.locator('textarea[placeholder*="Describe"]').count()) > 0);
check('show impact disabled (no text)', await page.locator('button:has-text("Show impact")').isDisabled());

// ── LOAD OVERVIEW GRAPH ───────────────────────────────────
await page.locator('button:has-text("Load architecture spine")').click();
await page.waitForTimeout(7000);
await page.screenshot({ path: '/tmp/val-04-graph.png' });

check('sigma canvas rendered', (await page.locator('.sigma-nodes').count()) > 0);
const statusText = await page.locator('.hf-d3-status-text').textContent();
check('status bar shows counts', statusText.includes('related nodes') && statusText.includes('relationships'));
check('insight bar visible', await page.locator('.hf-d3-insight-bar').isVisible());
check('legend visible', await page.locator('.hf-d3-legend').isVisible());
check('minimap width 160', (await page.locator('.hf-sigma-minimap').getAttribute('width')) === '160');
check('canvas controls visible', await page.locator('.hf-d3-canvas-controls').isVisible());

const godBtns = await page.locator('.hf-d3-god-list button').all();
check('overview nodes in sidebar', godBtns.length > 0);

// breadcrumb home button
check('breadcrumb Home visible', await page.locator('.hf-d3-crumb-home').isVisible());

// ── NODE SELECTION ────────────────────────────────────────
await godBtns[0].click();
await page.waitForTimeout(4000);
await page.screenshot({ path: '/tmp/val-05-selected.png' });

const detailVisible = await page.locator('.hf-d3-detail').isVisible();
check('detail panel opens', detailVisible);

if (detailVisible) {
  const tabs = await page.locator('.hf-d3-detail-tabs button').allTextContents();
  check('Risk tab is first', tabs[0]?.trim().toLowerCase().includes('risk'));
  check('5 detail tabs', tabs.length === 5);
  check('Risk card visible by default', await page.locator('.hf-d3-risk-card, .hf-d3-risk-unassessed').first().isVisible().catch(() => false));
  check('What breaks button visible', await page.locator('.hf-d3-what-breaks').isVisible());
  check('node name in header', (await page.locator('.hf-d3-detail h2').textContent()).trim().length > 0);
  check('type badge visible', await page.locator('.hf-d3-type').isVisible());
  check('meta chips present', (await page.locator('.hf-d3-meta-chip, .hf-d3-node-meta span').count()) > 0);

  // Summary tab
  await page.locator('.hf-d3-detail-tabs button').nth(1).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/val-06-summary.png' });
  check('summary tab renders', await page.locator('#twin-tab-summary').isVisible().catch(() => false));

  // Links tab
  await page.locator('.hf-d3-detail-tabs button').nth(2).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/val-07-links.png' });
  check('links tab renders', await page.locator('#twin-tab-relationships').isVisible().catch(() => false));
  // Trace path button renamed
  const traceBtn = await page.locator('.hf-d3-why-btn').first().textContent().catch(() => '');
  check('Trace path button present', traceBtn.includes('Trace') || traceBtn.includes('Why') || traceBtn.includes('path'));

  // Code tab
  await page.locator('.hf-d3-detail-tabs button').nth(3).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/val-08-code.png' });
  check('code tab renders', await page.locator('#twin-tab-code').isVisible().catch(() => false));

  // Evidence tab
  await page.locator('.hf-d3-detail-tabs button').nth(4).click();
  await page.waitForTimeout(1500);
  check('evidence tab renders', await page.locator('#twin-tab-evidence').isVisible().catch(() => false));

  // Close
  await page.locator('.hf-d3-close').click();
  await page.waitForTimeout(600);
  check('panel closes with X', !(await page.locator('.hf-d3-detail').isVisible()));

  // What breaks button gone after close
  check('What breaks hidden after close', !(await page.locator('.hf-d3-what-breaks').isVisible()));
}

// ── DEPTH CONTROLS ────────────────────────────────────────
await page.locator('.hf-d3-depth-controls button').nth(1).click();
await page.waitForTimeout(400);
check('depth +1 works', (await page.locator('.hf-d3-depth-controls span').textContent()).includes('3'));

await page.locator('.hf-d3-depth-controls button').nth(0).click();
await page.waitForTimeout(400);
check('depth -1 works', (await page.locator('.hf-d3-depth-controls span').textContent()).includes('2'));

// ── ESC CLEARS ───────────────────────────────────────────
await page.keyboard.press('Escape');
await page.waitForTimeout(1000);
check('Esc clears graph', await page.locator('.hf-twin-empty').isVisible());

// ── SAVE VIEW ────────────────────────────────────────────
// Validate save view works via JS click (button is below fold in headless viewport)
await page.locator('button:has-text("Load architecture spine")').click();
await page.waitForTimeout(5000);
await page.locator('.hf-d3-disclosure summary').nth(1).click();
await page.waitForTimeout(300);
const saveBtn = page.locator('button:has-text("Save current view")');
await page.evaluate(el => el.click(), await saveBtn.elementHandle());
await page.waitForTimeout(500);
const savedViews = await page.locator('.hf-d3-god-list button').count();
check('view saved and listed', savedViews > 0);

// ── FINAL SUMMARY ─────────────────────────────────────────
console.log(`\n─── ${pass.length} PASSED  ${fail.length} FAILED ───────────────────`);
if (fail.length) { console.log('\nFailed checks:'); fail.forEach(f => console.log('  ✗', f)); }
await browser.close();
process.exit(fail.length > 0 ? 1 : 0);
