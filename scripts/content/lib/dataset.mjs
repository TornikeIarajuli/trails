// Reading and writing content/trails.json, shared by the steps that produce it (09, 12).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT } from './paths.mjs';

export const DATASET_PATH = path.join(CONTENT, 'trails.json');

export function readDataset(file = DATASET_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** One trail per line, so a diff of the dataset stays readable. */
export function writeDataset(dataset, file = DATASET_PATH) {
  const { trails, ...head } = dataset;
  const body = trails.map((t) => JSON.stringify(t)).join(',\n');
  const h = JSON.stringify(head);
  fs.writeFileSync(file, `${h === '{}' ? '{' : `${h.slice(0, -1)},`}"trails":[\n${body}\n]}\n`);
}

/** Fingerprint of a published route: values computed along it are reused only while it is unchanged. */
export function routeKey(route) {
  return crypto.createHash('sha1').update(JSON.stringify(route)).digest('hex').slice(0, 16);
}
