import assert from 'node:assert/strict';
import test from 'node:test';
import {
  feedText,
  gdeltDate,
  parseFeed,
  parseGdelt,
  parseNewsApi,
} from './feeds.js';

test('RSS 2.0 items keep the feed’s title, link, date and description', () => {
  const xml = `<rss><channel><title>Feed</title>
    <item>
      <title><![CDATA[Quake strikes &amp; shakes region]]></title>
      <link>https://example.org/a?x=1&amp;y=2</link>
      <description>&lt;p&gt;A &lt;b&gt;strong&lt;/b&gt; quake.&lt;/p&gt;</description>
      <pubDate>Sat, 10 Oct 2026 10:00:00 GMT</pubDate>
    </item>
    <item><title>No date here</title><link>https://example.org/b</link></item>
  </channel></rss>`;
  const items = parseFeed(xml, 'Example');
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    title: 'Quake strikes & shakes region',
    summary: 'A strong quake.',
    url: 'https://example.org/a?x=1&y=2',
    publisher: 'Example',
    publishedAt: 'Sat, 10 Oct 2026 10:00:00 GMT',
  });
  // A missing date stays missing for the record rules to reject.
  assert.equal(items[1].publishedAt, '');
});

test('Atom entries use the alternate link and published time', () => {
  const xml = `<feed><entry>
      <title type="html">Probe reaches orbit</title>
      <link rel="self" href="https://example.org/self.xml"/>
      <link rel="alternate" href="https://example.org/probe"/>
      <summary>It arrived.</summary>
      <published>2026-10-10T09:00:00Z</published>
    </entry></feed>`;
  const [item] = parseFeed(xml, 'Example');
  assert.equal(item.url, 'https://example.org/probe');
  assert.equal(item.publishedAt, '2026-10-10T09:00:00Z');
  assert.equal(item.summary, 'It arrived.');
});

test('RDF items read dc:date', () => {
  const xml = `<rdf:RDF><item rdf:about="x">
      <title>Vote scheduled</title><link>https://example.org/v</link>
      <dc:date>2026-10-10T08:00:00+02:00</dc:date></item></rdf:RDF>`;
  assert.equal(
    parseFeed(xml, 'DW')[0].publishedAt,
    '2026-10-10T08:00:00+02:00',
  );
});

test('feedText decodes entities and never leaves markup', () => {
  assert.equal(
    feedText('Tom &amp; Jerry&#39;s &#x2014; show'),
    "Tom & Jerry's — show",
  );
  assert.equal(feedText('<a href="x">link</a> text'), 'link text');
  assert.equal(feedText(''), '');
});

test('a body that is not a feed yields no items', () => {
  assert.deepEqual(parseFeed('<html><body>Blocked</body></html>', 'X'), []);
  assert.deepEqual(parseFeed('', 'X'), []);
});

test('GDELT articles take the domain as publisher and ignore sourcecountry', () => {
  const [item] = parseGdelt({
    articles: [
      {
        title: 'Summit ends',
        url: 'https://www.example.com/s',
        domain: 'www.example.com',
        seendate: '20261010T093000Z',
        sourcecountry: 'France',
      },
    ],
  });
  assert.deepEqual(item, {
    title: 'Summit ends',
    summary: '',
    url: 'https://www.example.com/s',
    publisher: 'example.com',
    publishedAt: '2026-10-10T09:30:00Z',
  });
  assert.equal(gdeltDate('garbage'), '');
  assert.deepEqual(parseGdelt({}), []);
});

test('NewsAPI articles map source name and description', () => {
  const [item] = parseNewsApi({
    articles: [
      {
        title: 'Rates held',
        description: 'The bank waits.',
        url: 'https://example.com/r',
        source: { name: 'Example Wire' },
        publishedAt: '2026-10-10T07:00:00Z',
      },
    ],
  });
  assert.equal(item.publisher, 'Example Wire');
  assert.equal(item.summary, 'The bank waits.');
});
