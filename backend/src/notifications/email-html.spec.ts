import { emailHtml } from './email-html';

const button = { label: 'Fill in teacher details', url: 'https://app.test/teacher-form/s1/tok' };

describe('emailHtml', () => {
  it('turns the link line into a button and keeps the rest as text', () => {
    const html = emailHtml(`Dear <Principal>,\n\n${button.url}\n\nThanks`, button);
    expect(html).toContain('>Fill in teacher details</a>');
    expect(html).toContain('Dear &lt;Principal&gt;,<br>');
    expect(html).toContain('Thanks<br>');
    // Button once + backup link text once, not an extra raw line.
    expect(html.split(`href="${button.url}"`).length - 1).toBe(2);
  });

  it('adds the button at the end when the text has no link line', () => {
    const html = emailHtml('Hello', button);
    expect(html.indexOf('Hello')).toBeLessThan(html.indexOf('Fill in teacher details'));
  });
});
