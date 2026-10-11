import assert from 'node:assert/strict';
import test from 'node:test';
import { differingFigures, extractFigures } from './figures.js';

test('counted figures are read from headlines', () => {
  const cases = [
    ['Russian attack on Ukrainian city kills 20', [['killed', 20]]],
    [
      'Twelve killed and 300 injured in attack on airport',
      [
        ['killed', 12],
        ['injured', 300],
      ],
    ],
    [
      'Attack killed 12 people and wounded over 300 more',
      [
        ['killed', 12],
        ['injured', 300],
      ],
    ],
    [
      'At least 1,200 dead after floods; 40 missing',
      [
        ['killed', 1200],
        ['missing', 40],
      ],
    ],
    ['Powerful 7.7-magnitude earthquake strikes Panama', [['magnitude', 7.7]]],
    [
      'Magnitude 7.6 earthquake shakes Panama, USGS reports',
      [['magnitude', 7.6]],
    ],
    ['Floods displace 2 million in Pakistan', [['displaced', 2_000_000]]],
    ['Police arrest 45 after protest', [['arrested', 45]]],
    ['Parliament debates the budget for 2027', []],
    ['', []],
  ];
  for (const [title, expected] of cases)
    assert.deepEqual(
      extractFigures(title).map(({ what, value }) => [what, value]),
      expected,
      title,
    );
});

test('a year or an unrelated number is not a casualty figure', () => {
  assert.deepEqual(extractFigures('Storm leaves 650,000 without power'), []);
  assert.deepEqual(extractFigures('G7 leaders meet in 2026'), []);
});

test('differences between outlets are listed with who said what', () => {
  const diff = differingFigures([
    {
      publisher: 'France 24',
      title: 'Russian attack on Ukrainian city kills 15',
    },
    { publisher: 'CNA', title: 'Russian attack on Ukrainian city kills 20' },
    {
      publisher: 'BBC',
      title: 'Russian strike kills at least 20 in Ukrainian city',
    },
    { publisher: 'DW', title: 'Ukraine: Russian strike hits city centre' },
  ]);
  assert.deepEqual(diff, [
    {
      what: 'killed',
      values: [
        { value: 15, publishers: ['France 24'] },
        { value: 20, publishers: ['BBC', 'CNA'] },
      ],
    },
  ]);
});

test('agreeing figures, or a figure only one outlet gives, are not a difference', () => {
  assert.deepEqual(
    differingFigures([
      { publisher: 'A', title: 'Twelve killed in airport attack' },
      { publisher: 'B', title: 'Attack kills 12 at airport' },
      { publisher: 'C', title: 'Airport attack injures 300' },
    ]),
    [],
  );
  assert.deepEqual(differingFigures([]), []);
});
