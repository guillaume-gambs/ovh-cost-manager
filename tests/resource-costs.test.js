/**
 * Tests for the per-resource cost of Public Cloud projects: bill lines matched
 * to the imported inventory (snapshots, volumes, buckets, instances, savings
 * plans), through the data layer on a throwaway database.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'proj-1';
const FROM = '2026-03-01';
const TO = '2026-03-31';

let db;
let dataDir;
let lineCount = 0;
const previousDataDir = process.env.DATA_DIR;

// One bill per date, one bill line per call
function seedBillLine(description, totalPrice, date = '2026-03-01') {
  const billId = `FR-${date}`;
  db.bills.upsert({
    id: billId, date, price_without_tax: 0, price_with_tax: 0, tax: 0,
    currency: 'EUR', pdf_url: null, html_url: null
  });
  db.details.insert({
    id: `${billId}_${++lineCount}`, bill_id: billId, project_id: PROJECT, domain: PROJECT,
    description, quantity: 1, unit_price: totalPrice, total_price: totalPrice, service_type: null
  });
}

function seedSnapshot(snapshot) {
  db.cloudDetails.upsertSnapshot({
    project_id: PROJECT, name: snapshot.id, region: 'GRA1', size_gb: 10, status: 'active',
    visibility: 'private', os_type: 'linux', created_at: null, ...snapshot
  });
}

beforeAll(() => {
  // data/db.js reads DATA_DIR once, when it is first required
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocm-costs-'));
  process.env.DATA_DIR = dataDir;
  db = require('../data/db');
});

afterAll(() => {
  db.closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
});

beforeEach(() => {
  db.clearAll();
  db.projects.upsert({ id: PROJECT, name: 'Project 1', description: null, status: 'ok', created_at: null });
});

describe('snapshot cost', () => {
  test.each([
    ['gra1', 'GRA1'],
    ['eu-west-par', 'EU-WEST-PAR'],
    ['EU-WEST-PAR', 'EU-WEST-PAR']
  ])('spreads "Snapshots Public Cloud - %s" over the snapshots of that region', (billedRegion, region) => {
    seedSnapshot({ id: 'snap-1', region });
    seedBillLine(`Snapshots Public Cloud - ${billedRegion}`, 4.2);

    const snapshots = db.cloudDetails.getSnapshotsByProject(PROJECT, FROM, TO);

    expect(snapshots).toEqual([expect.objectContaining({ id: 'snap-1', total: 4.2, allocated: true })]);
  });
});
