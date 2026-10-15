// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Grok Processor Implementation
 * Pattern matching for parsing unstructured text
 */

import type { GrokConfig } from '../../types/dataPrepper';
import { getNestedValue, setNestedValue, deepClone } from './utils';
import { addEventTags } from './eventMetadata';

/**
 * Built-in grok patterns
 */
const BUILTIN_PATTERNS: Record<string, string> = {
  // Basic patterns
  'USERNAME': '[a-zA-Z0-9._-]+',
  'USER': '%{USERNAME}',
  'INT': '(?:[+-]?(?:[0-9]+))',
  'BASE10NUM': '(?:[+-]?(?:[0-9]+(?:\\.[0-9]+)?))',
  'NUMBER': '(?:%{BASE10NUM})',
  'BASE16NUM': '(?:0[xX]?[0-9a-fA-F]+)',
  'POSINT': '\\b(?:[1-9][0-9]*)\\b',
  'NONNEGINT': '\\b(?:[0-9]+)\\b',
  'WORD': '\\b\\w+\\b',
  'NOTSPACE': '\\S+',
  'SPACE': '\\s*',
  'DATA': '.*?',
  'GREEDYDATA': '.*',
  'QUOTEDSTRING': '"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'',
  'UUID': '[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12}',
  
  // Networking
  'MAC': '(?:%{CISCOMAC}|%{WINDOWSMAC}|%{COMMONMAC})',
  'CISCOMAC': '(?:[A-Fa-f0-9]{4}\\.){2}[A-Fa-f0-9]{4}',
  'WINDOWSMAC': '(?:[A-Fa-f0-9]{2}-){5}[A-Fa-f0-9]{2}',
  'COMMONMAC': '(?:[A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}',
  'IPV6': '(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}',
  'IPV4': '(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)',
  'IP': '(?:%{IPV6}|%{IPV4})',
  'HOSTNAME': '\\b(?:[0-9A-Za-z][0-9A-Za-z-]{0,62})(?:\\.(?:[0-9A-Za-z][0-9A-Za-z-]{0,62}))*(?:\\.?|\\b)',
  'HOST': '%{HOSTNAME}',
  'IPORHOST': '(?:%{IP}|%{HOSTNAME})',
  'HOSTPORT': '%{IPORHOST}:%{POSINT}',
  
  // Paths
  'PATH': '(?:%{UNIXPATH}|%{WINPATH})',
  'UNIXPATH': '(?:/[\\w_%!$@:.,~-]+)+',
  'WINPATH': '(?:[A-Za-z]:|\\\\)(?:\\\\[^\\\\?*]*)+',
  'URI': '%{URIPROTO}://(?:%{USER}(?::[^@]*)?@)?(?:%{URIHOST})?(?:%{URIPATHPARAM})?',
  'URIPROTO': '[A-Za-z][A-Za-z0-9+.-]*',
  'URIHOST': '%{IPORHOST}(?::%{POSINT})?',
  'URIPATH': '(?:/[A-Za-z0-9$.+!*\'(){},~:;=@#%_\\-]*)+',
  'URIPARAM': '\\?[A-Za-z0-9$.+!*\'|(){},~@#%&/=:;_?\\-\\[\\]<>]*',
  'URIPATHPARAM': '%{URIPATH}(?:%{URIPARAM})?',
  
  // Dates and times
  'MONTH': '\\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\b',
  'MONTHNUM': '(?:0?[1-9]|1[0-2])',
  'MONTHDAY': '(?:0?[1-9]|[12][0-9]|3[01])',
  'DAY': '(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)',
  'YEAR': '(?:\\d{2}){1,2}',
  'HOUR': '(?:2[0123]|[01]?[0-9])',
  'MINUTE': '(?:[0-5][0-9])',
  'SECOND': '(?:(?:[0-5]?[0-9]|60)(?:[:.,][0-9]+)?)',
  'TIME': '(?:%{HOUR}:%{MINUTE}:%{SECOND})',
  'DATE_US': '%{MONTHNUM}[/-]%{MONTHDAY}[/-]%{YEAR}',
  'DATE_EU': '%{MONTHDAY}[./-]%{MONTHNUM}[./-]%{YEAR}',
  'ISO8601_TIMEZONE': '(?:Z|[+-]%{HOUR}(?::?%{MINUTE})?)',
  'ISO8601_SECOND': '(?:%{SECOND}|60)',
  'TIMESTAMP_ISO8601': '%{YEAR}-%{MONTHNUM}-%{MONTHDAY}[T ]%{HOUR}:?%{MINUTE}(?::?%{SECOND})?%{ISO8601_TIMEZONE}?',
  'DATE': '%{DATE_US}|%{DATE_EU}',
  'DATESTAMP': '%{DATE}[- ]%{TIME}',
  'TZ': '(?:[PMCE][SD]T|UTC)',
  'DATESTAMP_RFC822': '%{DAY} %{MONTH} %{MONTHDAY} %{YEAR} %{TIME} %{TZ}',
  'DATESTAMP_RFC2822': '%{DAY}, %{MONTHDAY} %{MONTH} %{YEAR} %{TIME} %{ISO8601_TIMEZONE}',
  'DATESTAMP_OTHER': '%{DAY} %{MONTH} %{MONTHDAY} %{TIME} %{TZ} %{YEAR}',
  'DATESTAMP_EVENTLOG': '%{YEAR}%{MONTHNUM}%{MONTHDAY}%{HOUR}%{MINUTE}%{SECOND}',
  
  // Syslog
  'SYSLOGTIMESTAMP': '%{MONTH} +%{MONTHDAY} %{TIME}',
  'PROG': '[\\x21-\\x5a\\x5c\\x5e-\\x7e]+',
  'SYSLOGPROG': '%{PROG:program}(?:\\[%{POSINT:pid}\\])?',
  'SYSLOGHOST': '%{IPORHOST}',
  'SYSLOGFACILITY': '<%{NONNEGINT:facility}.%{NONNEGINT:priority}>',
  'SYSLOGBASE': '%{SYSLOGTIMESTAMP:timestamp} (?:%{SYSLOGFACILITY} )?%{SYSLOGHOST:logsource} %{SYSLOGPROG}:',
  
  // Log levels
  'LOGLEVEL': '(?:[Aa]lert|ALERT|[Tt]race|TRACE|[Dd]ebug|DEBUG|[Nn]otice|NOTICE|[Ii]nfo|INFO|[Ww]arn(?:ing)?|WARN(?:ING)?|[Ee]rr(?:or)?|ERR(?:OR)?|[Cc]rit(?:ical)?|CRIT(?:ICAL)?|[Ff]atal|FATAL|[Ss]evere|SEVERE|EMERG(?:ENCY)?|[Ee]merg(?:ency)?)',
  
  // HTTP
  'HTTPDATE': '%{MONTHDAY}/%{MONTH}/%{YEAR}:%{TIME} %{INT}',
  
  // Common log format
  'COMMONAPACHELOG': '%{IPORHOST:clientip} %{USER:ident} %{USER:auth} \\[%{HTTPDATE:timestamp}\\] "(?:%{WORD:verb} %{NOTSPACE:request}(?: HTTP/%{NUMBER:httpversion})?|%{DATA:rawrequest})" %{NUMBER:response} (?:%{NUMBER:bytes}|-)',
  'COMBINEDAPACHELOG': '%{COMMONAPACHELOG} %{QUOTEDSTRING:referrer} %{QUOTEDSTRING:agent}',
};

/**
 * Apply grok processor to an event
 */
export function applyGrok(
  event: Record<string, unknown>,
  config: GrokConfig
): Record<string, unknown> {
  let result = deepClone(event);
  if (!config.match) return result;
  const patterns = { ...BUILTIN_PATTERNS, ...config.pattern_definitions };
  const captures: Record<string, unknown> = Object.create(null);
  const overwrite = new Set(config.keys_to_overwrite ?? []);
  const merge = (existing: unknown, value: unknown): unknown => [
    ...(Array.isArray(existing) ? existing : [existing]),
    ...(Array.isArray(value) ? value : [value]),
  ];
  let matched = false;
  for (const [field, fieldPatterns] of Object.entries(config.match)) {
    const value = getNestedValue(result, field);
    if (typeof value !== 'string' || value === '') continue;
    for (const pattern of fieldPatterns) {
      const extracted = matchGrokPattern(value, pattern, patterns, config.named_captures_only !== false);
      for (const [key, capture] of Object.entries(extracted ?? {})) {
        if (capture === '' && !config.keep_empty_captures) continue;
        captures[key] = Object.prototype.hasOwnProperty.call(captures, key) && !overwrite.has(key)
          ? merge(captures[key], capture) : capture;
      }
      matched = Object.keys(captures).length > 0;
      if (matched && config.break_on_match !== false) break;
    }
    if (matched && config.break_on_match !== false) break;
  }
  if (Object.keys(captures).length === 0) addEventTags(result, config.tags_on_match_failure);
  if (config.target_key !== undefined) return setNestedValue(result, config.target_key, captures);
  for (const [key, value] of Object.entries(captures)) {
    const existing = getNestedValue(result, key);
    result = setNestedValue(result, key, existing !== undefined && !overwrite.has(key) ? merge(existing, value) : value);
  }
  return result;
}

/**
 * Match a grok pattern against a string
 */
function matchGrokPattern(
  input: string,
  pattern: string,
  patterns: Record<string, string>,
  namedCapturesOnly: boolean
): Record<string, string> | null {
  const { regex, captures } = compileGrokPattern(pattern, patterns);
  
  try {
    const match = input.match(regex);
    if (!match) {
      return null;
    }

    const result: Record<string, string> = {};
    
    for (const { group, field: captureName } of captures) {
      const matchValue = match.groups?.[group];
      if (captureName && matchValue !== undefined && (!namedCapturesOnly || !captureName.startsWith('_anon_'))) {
        result[captureName] = matchValue;
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Compile a grok pattern to a regex
 */
function compileGrokPattern(
  pattern: string,
  patterns: Record<string, string>
): { regex: RegExp; captures: { group: string; field: string }[] } {
  const captures: { group: string; field: string }[] = [];
  let nextGroup = 0;
  const expand = (source: string, depth: number): string => {
    if (depth > 10) throw new Error('Grok pattern recursion limit exceeded');
    return source.replace(/%\{(\w+)(?::(\w+))?\}/g, (_, patternName: string, captureName?: string) => {
      const id = nextGroup++;
      const group = `grok_capture_${id}`;
      captures.push({ group, field: captureName ?? `_anon_${id}` });
      const definition = Object.prototype.hasOwnProperty.call(patterns, patternName)
        ? patterns[patternName] : undefined;
      if (definition === undefined) throw new Error(`Grok pattern not available in local simulation: ${patternName}`);
      const expanded = expand(definition, depth + 1);
      return `(?<${group}>${expanded})`;
    });
  };
  return { regex: new RegExp(expand(pattern, 0)), captures };
}
