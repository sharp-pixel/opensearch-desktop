// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

// @vitest-environment jsdom
// DOMPurify requires a browser-compatible DOM; happy-dom does not model its sanitization correctly.
/**
 * Property-based tests for Markdown Renderer
 * Feature: opensearch-notebook-ui
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { renderMarkdown, sanitizeHtml, containsDangerousContent } from '../../utils/markdownRenderer';

describe('Markdown Renderer Property Tests', () => {
  /**
   * Property 19: Markdown Rendering Produces Output
   * For any non-empty markdown string, the renderer should produce a non-empty
   * HTML string that represents the formatted content.
   * Validates: Requirements 9.1
   */
  it('Property 19: Markdown Rendering Produces Output', () => {
    // Generator for non-empty markdown strings with actual content
    const nonEmptyMarkdownArb = fc.oneof(
      // Plain text
      fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      // Headers
      fc.tuple(
        fc.constantFrom('# ', '## ', '### ', '#### ', '##### ', '###### '),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
      ).map(([prefix, text]) => prefix + text),
      // Bold text
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !s.includes('*'))
        .map(text => `**${text}**`),
      // Italic text
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !s.includes('*'))
        .map(text => `*${text}*`),
      // Lists
      fc.array(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        { minLength: 1, maxLength: 5 }
      ).map(items => items.map(item => `- ${item}`).join('\n')),
      // Code blocks
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
        .map(code => `\`${code}\``),
      // Links
      fc.tuple(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('[') && !s.includes(']')),
        fc.webUrl()
      ).map(([text, url]) => `[${text}](${url})`),
    );

    fc.assert(
      fc.property(nonEmptyMarkdownArb, (markdown) => {
        const html = renderMarkdown(markdown);
        
        // Non-empty markdown should produce non-empty HTML
        expect(html.length).toBeGreaterThan(0);
        
        // HTML should contain some content (not just whitespace)
        expect(html.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20: Markdown XSS Sanitization
   * For any markdown input containing potentially malicious content (script tags,
   * event handlers, javascript: URLs), the rendered HTML output should not contain
   * any executable JavaScript code or dangerous attributes.
   * Validates: Requirements 9.5
   */
  it('Property 20: Markdown XSS Sanitization - Script Tags Removed', () => {
    // Generator for markdown with embedded script tags
    const markdownWithScriptArb = fc.tuple(
      fc.string({ minLength: 0, maxLength: 50 }),
      fc.constantFrom(
        '<script>alert("xss")</script>',
        '<script src="evil.js"></script>',
        '<SCRIPT>document.cookie</SCRIPT>',
        '<script type="text/javascript">malicious()</script>',
        '<scr<script>ipt>alert(1)</script>',
      ),
      fc.string({ minLength: 0, maxLength: 50 })
    ).map(([before, script, after]) => `${before}${script}${after}`);

    fc.assert(
      fc.property(markdownWithScriptArb, (markdown) => {
        const html = renderMarkdown(markdown);
        
        // Literal tag text in a math-error title is inert; inspect parsed elements.
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        expect(parsed.querySelector('script')).toBeNull();
      }),
      { numRuns: 100, examples: [['$#<script>alert("xss")</script>$']] }
    );
  });

  it('Property 20: Markdown XSS Sanitization - Event Handlers Removed', () => {
    // Generator for markdown with event handlers (unescaped HTML)
    const markdownWithEventHandlerArb = fc.tuple(
      fc.string({ minLength: 0, maxLength: 30 }).filter(s => !s.includes('<') && !s.includes('\\')),
      fc.constantFrom(
        '<img src="x" onerror="alert(1)">',
        '<div onmouseover="alert(1)">hover</div>',
        '<a href="#" onclick="alert(1)">click</a>',
        '<body onload="alert(1)">',
        '<input onfocus="alert(1)">',
        '<svg onload="alert(1)">',
        '<img src=x onerror=alert(1)>',
        '<div ONMOUSEOVER="alert(1)">test</div>',
      ),
      fc.string({ minLength: 0, maxLength: 30 }).filter(s => !s.includes('<') && !s.includes('\\'))
    ).map(([before, handler, after]) => `${before}${handler}${after}`);

    fc.assert(
      fc.property(markdownWithEventHandlerArb, (markdown) => {
        const html = renderMarkdown(markdown);
        
        // Output should not contain event handlers as actual HTML attributes
        // Note: HTML-encoded text like &lt;img onerror=... is safe (it's just text)
        // We check that no actual on* attributes exist in the HTML
        const hasEventHandler = /<[^>]+\s+on\w+\s*=/i.test(html);
        expect(hasEventHandler).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 20: Markdown XSS Sanitization - JavaScript URLs Removed', () => {
    // Generator for markdown with javascript: URLs (unescaped HTML)
    const markdownWithJsUrlArb = fc.tuple(
      fc.string({ minLength: 0, maxLength: 30 }).filter(s => !s.includes('<') && !s.includes('\\')),
      fc.constantFrom(
        '<a href="javascript:alert(1)">click</a>',
        '<a href="JAVASCRIPT:alert(1)">click</a>',
        '<a href="javascript:void(0)">link</a>',
        '<img src="javascript:alert(1)">',
        '[click](javascript:alert(1))',
        '<a href="  javascript:alert(1)">spaced</a>',
      ),
      fc.string({ minLength: 0, maxLength: 30 }).filter(s => !s.includes('<') && !s.includes('\\'))
    ).map(([before, jsUrl, after]) => `${before}${jsUrl}${after}`);

    fc.assert(
      fc.property(markdownWithJsUrlArb, (markdown) => {
        const html = renderMarkdown(markdown);
        
        // Output should not contain javascript: URLs in actual href attributes
        // Note: HTML-encoded text like &lt;a href="javascript:..." is safe (it's just text)
        const hasJsUrl = /<a[^>]+href\s*=\s*["']?\s*javascript:/i.test(html);
        expect(hasJsUrl).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Empty input produces empty output
   */
  it('Empty input produces empty output', () => {
    const emptyInputs = ['', '   ', '\n', '\t', '\r\n', '  \n  \t  '];
    
    for (const input of emptyInputs) {
      const html = renderMarkdown(input);
      expect(html).toBe('');
    }
  });

  /**
   * Additional property: Standard markdown syntax is preserved
   */
  it('Standard markdown syntax is rendered correctly', () => {
    const testCases = [
      { markdown: '# Header', expectedTag: '<h1>' },
      { markdown: '## Header 2', expectedTag: '<h2>' },
      { markdown: '**bold**', expectedTag: '<strong>' },
      { markdown: '*italic*', expectedTag: '<em>' },
      { markdown: '- item', expectedTag: '<li>' },
      { markdown: '`code`', expectedTag: '<code>' },
      { markdown: '[link](https://example.com)', expectedTag: '<a' },
    ];
    
    for (const { markdown, expectedTag } of testCases) {
      const html = renderMarkdown(markdown);
      expect(html.toLowerCase()).toContain(expectedTag.toLowerCase());
    }
  });

  /**
   * Test containsDangerousContent utility
   */
  it('containsDangerousContent detects dangerous patterns', () => {
    const dangerousInputs = [
      '<script>alert(1)</script>',
      '<img onerror="alert(1)">',
      '<a href="javascript:alert(1)">',
      '<div onclick="malicious()">',
      'data: text/html,<script>',
    ];
    
    for (const input of dangerousInputs) {
      expect(containsDangerousContent(input)).toBe(true);
    }
  });

  it('containsDangerousContent allows safe content', () => {
    const safeInputs = [
      'Hello world',
      '# Header',
      '**bold text**',
      '[link](https://example.com)',
      '`code block`',
    ];
    
    for (const input of safeInputs) {
      expect(containsDangerousContent(input)).toBe(false);
    }
  });

  /**
   * Test sanitizeHtml utility
   */
  it('sanitizeHtml removes dangerous content', () => {
    const html = '<p>Safe</p><script>alert(1)</script>';
    const sanitized = sanitizeHtml(html);
    
    expect(sanitized).toContain('<p>Safe</p>');
    expect(sanitized.toLowerCase()).not.toContain('<script');
  });

  it('sanitizeHtml removes event handlers from allowed tags', () => {
    // Test with a tag that's in the allowed list but has an event handler
    const html = '<p onclick="bad()">text</p>';
    const sanitized = sanitizeHtml(html);
    
    // The <p> tag should remain but onclick should be removed
    expect(sanitized).toContain('<p>');
    expect(sanitized).toContain('text');
    const hasOnclick = /onclick/i.test(sanitized);
    expect(hasOnclick).toBe(false);
  });
});
