/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import markdown from 'scripts/core/markdown';

describe('markdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('light', () => {
    test('sanitize', () => {
      expect(markdown('<script type="test/script">console.log(\'ok\');</script>')).toBe('&lt;script type=&quot;test/script&quot;&gt;console.log(&#039;ok&#039;);&lt;/script&gt;');
    });

    test('tab', () => {
      expect(markdown('\t \t \t \t  test\n\t \t \t \t  test')).toBe('test<br />test');
    });

    test('strong', () => {
      expect(markdown('^test^')).toBe('<strong class="ui-markdown ui-markdown--strong">test</strong>');
      expect(markdown('\\^test^')).toBe('^test^');
      expect(markdown('\\\\^this^ is a \\^test^')).toBe('\\<strong class="ui-markdown ui-markdown--strong">this</strong> is a ^test^');
      expect(markdown('^the formula 2\\^3 equals 8^')).toBe('<strong class="ui-markdown ui-markdown--strong">the formula 2^3 equals 8</strong>');
    });

    test('emphasis', () => {
      expect(markdown('*test*')).toBe('<span class="ui-markdown ui-markdown--emphasis">test</span>');
      expect(markdown('\\*test*')).toBe('*test*');
      expect(markdown('\\\\*this* is a *test\\*')).toBe('\\<span class="ui-markdown ui-markdown--emphasis">this</span> is a *test*');
      expect(markdown('*the formula 2\\*3 equals 6*')).toBe('<span class="ui-markdown ui-markdown--emphasis">the formula 2*3 equals 6</span>');
    });

    test('underline', () => {
      expect(markdown('_test_')).toBe('<span class="ui-markdown ui-markdown--underline">test</span>');
      expect(markdown('\\_test_')).toBe('_test_');
      expect(markdown('\\\\_this_ is a _test\\_')).toBe('\\<span class="ui-markdown ui-markdown--underline">this</span> is a _test_');
      expect(markdown('_the formula 2\\_3 equals 2.3_')).toBe('<span class="ui-markdown ui-markdown--underline">the formula 2_3 equals 2.3</span>');
    });

    test('italic', () => {
      expect(markdown('~test~')).toBe('<span class="ui-markdown ui-markdown--italic">test</span>');
      expect(markdown('\\~test~')).toBe('~test~');
      expect(markdown('\\\\~this~ is a ~test\\~')).toBe('\\<span class="ui-markdown ui-markdown--italic">this</span> is a ~test~');
      expect(markdown('~the formula 2\\~3 equals nothing~')).toBe('<span class="ui-markdown ui-markdown--italic">the formula 2~3 equals nothing</span>');
    });

    test('blockquote', () => {
      expect(markdown('> test')).toBe('<blockquote class="ui-blockquote">test</blockquote>');
    });

    test('image', () => {
      expect(markdown('![title](https://path/to/image)')).toBe('!<a class="ui-link" href="https://path/to/image">title</a>');
    });

    test('headings', () => {
      expect(markdown('# test')).toBe('# test');
      expect(markdown('## test')).toBe('## test');
      expect(markdown('### test')).toBe('### test');
      expect(markdown('#### test')).toBe('#### test');
      expect(markdown('##### test')).toBe('##### test');
      expect(markdown('###### test')).toBe('###### test');
      expect(markdown('####### test')).toBe('####### test');
      expect(markdown('\\# test')).toBe('\\# test');
    });

    test('hr', () => {
      expect(markdown('\n--\n')).toBe('<br />--<br />');
    });

    test('p', () => {
      expect(markdown('test\n\n\ntest\ntest\n\ntest')).toBe('test<br /><br /><br />test<br />test<br /><br />test');
    });

    test('inline code', () => {
      expect(markdown('test `code` test')).toBe('test <code class="ui-markdown ui-markdown--code">code</code> test');
      expect(markdown('test \\`code` test')).toBe('test `code` test');
      expect(markdown('\\\\`this` is a `JS keyword\\`')).toBe('\\<code class="ui-markdown ui-markdown--code">this</code> is a `JS keyword`');
      expect(markdown('`the formula 2\\`3 equals nothing`')).toBe('<code class="ui-markdown ui-markdown--code">the formula 2`3 equals nothing</code>');
    });

    test('link', () => {
      expect(markdown('[Test O\'Brian](/test) ')).toBe('<a class="ui-link" href="/test">Test O&#039;Brian</a>');
      expect(markdown('[Test](/test|no referer) ')).toBe('<a class="ui-link" href="/test" rel="no referer">Test</a>');
      expect(markdown('[Test](/test|no referer) ')).toBe('<a class="ui-link" href="/test" rel="no referer">Test</a>');
      expect(markdown('[Test](/test|no referer|_blank) ')).toBe('<a class="ui-link" href="/test" rel="no referer" target="_blank">Test</a>');
      expect(markdown('test [my link](https://test.com) test [my other link](https://test2.com)')).toBe('test <a class="ui-link" href="https://test.com">my link</a> test <a class="ui-link" href="https://test2.com">my other link</a>');
    });

    test('unordered list', () => {
      expect(markdown('test:\n - first\n - second\n - third')).toBe('test:<br /><ul class="ui-list ui-list--unordered"><li>first</li><li>second</li><li>third</li></ul>');
    });

    test('ordered list', () => {
      expect(markdown('test:\n 1. first\n 2. second\n 3. third')).toBe('test:<br /><ol class="ui-list ui-list--ordered"><li>first</li><li>second</li><li>third</li></ol>');
    });

    test('escaped chars', () => {
      expect(markdown('\\^strong^ \\*emphasis\\* \\_underline\\_ \\~italic\\~ \\\\test 3 \\* 2 \\* 1 = 6')).toBe('^strong^ *emphasis* _underline_ ~italic~ \\test 3 * 2 * 1 = 6');
    });
  });

  describe('full', () => {
    test('sanitize', () => {
      expect(markdown('<script type="test/script">console.log(\'ok\');</script>', false)).toBe('<p class="ui-p">&lt;script type=&quot;test/script&quot;&gt;console.log(&#039;ok&#039;);&lt;/script&gt;</p>');
    });

    test('tab', () => {
      expect(markdown('\t \t \t \t  test\n\t \t \t \t  test', false)).toBe('<p class="ui-p">test<br />test</p>');
    });

    test('strong', () => {
      expect(markdown('^test^', false)).toBe('<p class="ui-p"><strong class="ui-markdown ui-markdown--strong">test</strong></p>');
      expect(markdown('\\^test^', false)).toBe('<p class="ui-p">^test^</p>');
      expect(markdown('\\\\^this^ is a \\^test\\^', false)).toBe('<p class="ui-p">\\<strong class="ui-markdown ui-markdown--strong">this</strong> is a ^test^</p>');
      expect(markdown('^the formula 2\\^3 equals 8^', false)).toBe('<p class="ui-p"><strong class="ui-markdown ui-markdown--strong">the formula 2^3 equals 8</strong></p>');
    });

    test('emphasis', () => {
      expect(markdown('*test*', false)).toBe('<p class="ui-p"><span class="ui-markdown ui-markdown--emphasis">test</span></p>');
      expect(markdown('\\*test*', false)).toBe('<p class="ui-p">*test*</p>');
      expect(markdown('\\\\*this* is a *test\\*', false)).toBe('<p class="ui-p">\\<span class="ui-markdown ui-markdown--emphasis">this</span> is a *test*</p>');
      expect(markdown('*the formula 2\\*3 equals 6*', false)).toBe('<p class="ui-p"><span class="ui-markdown ui-markdown--emphasis">the formula 2*3 equals 6</span></p>');
    });

    test('underline', () => {
      expect(markdown('_test_', false)).toBe('<p class="ui-p"><span class="ui-markdown ui-markdown--underline">test</span></p>');
      expect(markdown('\\_test_', false)).toBe('<p class="ui-p">_test_</p>');
      expect(markdown('\\\\_this_ is a _test\\_', false)).toBe('<p class="ui-p">\\<span class="ui-markdown ui-markdown--underline">this</span> is a _test_</p>');
      expect(markdown('_the formula 2\\_3 equals 2.3_', false)).toBe('<p class="ui-p"><span class="ui-markdown ui-markdown--underline">the formula 2_3 equals 2.3</span></p>');
    });

    test('italic', () => {
      expect(markdown('~test~', false)).toBe('<p class="ui-p"><span class="ui-markdown ui-markdown--italic">test</span></p>');
      expect(markdown('\\~test~', false)).toBe('<p class="ui-p">~test~</p>');
      expect(markdown('\\\\~this~ is a ~test\\~', false)).toBe('<p class="ui-p">\\<span class="ui-markdown ui-markdown--italic">this</span> is a ~test~</p>');
      expect(markdown('~the formula 2\\~3 equals nothing~', false)).toBe('<p class="ui-p"><span class="ui-markdown ui-markdown--italic">the formula 2~3 equals nothing</span></p>');
    });

    test('blockquote', () => {
      expect(markdown('> test', false)).toBe('<blockquote class="ui-blockquote">test</blockquote>');
    });

    test('image', () => {
      expect(markdown('![title](https://path/to/image)', false)).toBe('<img class="ui-image" src="https://path/to/image" alt="title" />');
    });

    test('headings', () => {
      expect(markdown('# test', false)).toBe('<h1 class="ui-title ui-title--1">test</h1>');
      expect(markdown('## test', false)).toBe('<h2 class="ui-title ui-title--2">test</h2>');
      expect(markdown('### test', false)).toBe('<h3 class="ui-title ui-title--3">test</h3>');
      expect(markdown('#### test', false)).toBe('<h4 class="ui-title ui-title--4">test</h4>');
      expect(markdown('##### test', false)).toBe('<h5 class="ui-title ui-title--5">test</h5>');
      expect(markdown('###### test', false)).toBe('<h6 class="ui-title ui-title--6">test</h6>');
      expect(markdown('####### test', false)).toBe('<p class="ui-p">####### test</p>');
      expect(markdown('\\# test', false)).toBe('<p class="ui-p">\\# test</p>');
    });

    test('hr', () => {
      expect(markdown('\n--\n', false)).toBe('<hr />');
    });

    test('p', () => {
      expect(markdown('test\n\ntest\ntest\n\ntest', false)).toBe('<p class="ui-p">test</p><p class="ui-p">test<br />test</p><p class="ui-p">test</p>');
    });

    test('inline code', () => {
      expect(markdown('test `code` test', false)).toBe('<p class="ui-p">test <code class="ui-markdown ui-markdown--code">code</code> test</p>');
      expect(markdown('test \\`code` test', false)).toBe('<p class="ui-p">test `code` test</p>');
      expect(markdown('\\\\`this` is a `JS keyword\\`', false)).toBe('<p class="ui-p">\\<code class="ui-markdown ui-markdown--code">this</code> is a `JS keyword`</p>');
      expect(markdown('`the formula 2\\`3 equals nothing`', false)).toBe('<p class="ui-p"><code class="ui-markdown ui-markdown--code">the formula 2`3 equals nothing</code></p>');
    });

    test('link', () => {
      expect(markdown('test [my link](https://test.com) test', false)).toBe('<p class="ui-p">test <a class="ui-link" href="https://test.com">my link</a> test</p>');
    });

    test('unordered list', () => {
      expect(markdown('test:\n - first\n - second\n - third', false)).toBe('<p class="ui-p">test:<br /><ul class="ui-list ui-list--unordered"><li>first</li><li>second</li><li>third</li></ul></p>');
    });

    test('ordered list', () => {
      expect(markdown('test:\n 1. first\n 2. second\n 3. third', false)).toBe('<p class="ui-p">test:<br /><ol class="ui-list ui-list--ordered"><li>first</li><li>second</li><li>third</li></ol></p>');
    });
  });
});
