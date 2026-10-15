// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Markdown Renderer Utility for OpenSearch Notebook
 * Renders markdown to HTML with XSS sanitization and LaTeX math support
 * Requirements: 9.1, 9.4, 9.5
 */

import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import DOMPurify from 'dompurify';

// Configure marked with KaTeX extension for math rendering
// Supports both inline ($...$) and display ($$...$$) math
marked.use(markedKatex({
  throwOnError: false, // Don't throw on invalid LaTeX, show error message instead
  output: 'html',
}));

/**
 * Configuration for DOMPurify sanitization
 * Removes all potentially dangerous content while preserving safe markdown output
 * 
 * Note: We use ALLOWED_TAGS as a whitelist approach - only tags in this list are allowed.
 * This is more secure than using FORBID_TAGS which is a blacklist approach.
 */
const SANITIZE_CONFIG = {
  // Allow common HTML tags produced by markdown and KaTeX
  // Script, iframe, object, embed, form, input, button are NOT in this list
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'blockquote',
    'pre', 'code',
    'a',
    'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
    'span', 'div',
    // KaTeX-specific tags
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub',
    'mfrac', 'mroot', 'msqrt', 'mtext', 'mspace', 'mtable', 'mtr', 'mtd',
    'annotation', 'svg', 'path', 'line', 'rect', 'g', 'use', 'defs',
    // Allow style tag for KaTeX CSS (content is sanitized by DOMPurify)
    'style',
  ],
  // Allow safe attributes including KaTeX styling
  // Note: 'style' attribute is intentionally excluded to prevent XSS via CSS injection
  // KaTeX uses class-based styling which is safer
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel',
    'src', 'alt', 'width', 'height',
    'class', 'id',
    // KaTeX/MathML attributes
    'xmlns', 'encoding', 'mathvariant', 'stretchy', 'fence', 'separator',
    'accent', 'accentunder', 'columnalign', 'rowspacing', 'columnspacing',
    'd', 'viewBox', 'preserveAspectRatio', 'fill', 'stroke', 'stroke-width',
    'transform', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'xlink:href',
    'aria-hidden', 'focusable', 'role',
  ],
  // Forbid dangerous URI schemes
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Render markdown string to sanitized HTML with LaTeX math support
 * Requirements: 9.1, 9.4, 9.5
 * 
 * Supports:
 * - Inline math: $x \times y$ or \(x \times y\)
 * - Display math: $$\sum_{i=1}^n x_i$$ or \[\sum_{i=1}^n x_i\]
 * 
 * @param markdown - The markdown string to render
 * @returns Sanitized HTML string
 */
export function renderMarkdown(markdown: string): string {
  // Handle empty input
  if (!markdown || markdown.trim() === '') {
    return '';
  }

  // Parse markdown to HTML using marked (with KaTeX extension)
  const rawHtml = marked.parse(markdown, {
    async: false,
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
  }) as string;

  // Sanitize HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);

  return sanitizedHtml as string;
}

/**
 * Check if a string contains potentially dangerous content
 * Useful for pre-validation before rendering
 * 
 * @param content - The content to check
 * @returns true if content contains potentially dangerous patterns
 */
export function containsDangerousContent(content: string): boolean {
  // Check for script tags
  if (/<script\b/i.test(content)) {
    return true;
  }

  // Check for event handlers
  if (/\bon\w+\s*=/i.test(content)) {
    return true;
  }

  // Check for javascript: URLs
  if (/javascript:/i.test(content)) {
    return true;
  }

  // Check for data: URLs with script content
  if (/data:\s*text\/html/i.test(content)) {
    return true;
  }

  return false;
}

/**
 * Sanitize HTML string without markdown parsing
 * Useful for sanitizing pre-rendered HTML content
 * 
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (!html) {
    return '';
  }
  
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as string;
}
