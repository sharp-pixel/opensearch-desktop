// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for SchemaAnalyzer
 * Feature: d3-chart-visualizations
 * Properties 1-9: Column classification and chart compatibility
 * Validates: Requirements 3.2, 3.3, 3.4, 3.5, 1.5, 2.3, 4.1, 5.1, 6.1, 7.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { PPLColumn } from '../../types/cell';
import type { ConsolidatedRow } from '../../types/investigation';
import {
  isTemporalType,
  isGeoType,
  isNumericType,
  isStringType,
  isLatitudeColumn,
  isLongitudeColumn,
  analyzeSchema,
  getCompatibleChartTypes,
  getDisabledReason,
} from '../../services/schemaAnalyzer';

// Generators for test data

const temporalTypeArb = fc.constantFrom(
  'timestamp', 'date', 'datetime', 'time', 'TIMESTAMP', 'DATE', 'DATETIME'
);

const geoTypeArb = fc.constantFrom('geo_point', 'geo_shape', 'GEO_POINT');

const numericTypeArb = fc.constantFrom(
  'integer', 'int', 'long', 'short', 'byte', 'float', 'double',
  'half_float', 'scaled_float', 'unsigned_long', 'number',
  'INTEGER', 'LONG', 'FLOAT', 'DOUBLE'
);

const stringTypeArb = fc.constantFrom(
  'string', 'keyword', 'text', 'varchar', 'char',
  'STRING', 'KEYWORD', 'TEXT'
);

const nonTemporalTypeArb = fc.constantFrom(
  'integer', 'string', 'boolean', 'geo_point', 'keyword', 'float'
);

const nonGeoTypeArb = fc.constantFrom(
  'integer', 'string', 'boolean', 'timestamp', 'keyword', 'float'
);

const columnNameArb = fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0);

const latColumnNameArb = fc.constantFrom('lat', 'latitude', 'geo_lat', 'location_lat', 'LAT', 'LATITUDE');
const lonColumnNameArb = fc.constantFrom('lon', 'lng', 'longitude', 'geo_lon', 'location_lng', 'LON', 'LONGITUDE');

// Generate a PPL column
const pplColumnArb = (typeArb: fc.Arbitrary<string>) => fc.record({
  name: columnNameArb,
  type: typeArb,
});

describe('Feature: d3-chart-visualizations - Schema Analyzer', () => {
  describe('Property 1: Temporal Column Classification', () => {
    it('should classify timestamp/date/datetime types as temporal', () => {
      fc.assert(
        fc.property(temporalTypeArb, (type) => {
          expect(isTemporalType(type)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should not classify non-temporal types as temporal', () => {
      fc.assert(
        fc.property(nonTemporalTypeArb, (type) => {
          expect(isTemporalType(type)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should classify temporal columns in schema analysis', () => {
      fc.assert(
        fc.property(
          temporalTypeArb,
          columnNameArb,
          (type, name) => {
            const schema: PPLColumn[] = [{ name, type }];
            const rows: ConsolidatedRow[] = [];
            const analysis = analyzeSchema(schema, rows);
            
            expect(analysis.temporalColumns).toContain(name);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Geographic Column Classification', () => {
    it('should classify geo_point/geo_shape types as geographic', () => {
      fc.assert(
        fc.property(geoTypeArb, (type) => {
          expect(isGeoType(type)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should not classify non-geo types as geographic', () => {
      fc.assert(
        fc.property(nonGeoTypeArb, (type) => {
          expect(isGeoType(type)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should recognize latitude column names', () => {
      fc.assert(
        fc.property(latColumnNameArb, (name) => {
          expect(isLatitudeColumn(name)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should recognize longitude column names', () => {
      fc.assert(
        fc.property(lonColumnNameArb, (name) => {
          expect(isLongitudeColumn(name)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should classify geo columns in schema analysis', () => {
      fc.assert(
        fc.property(geoTypeArb, columnNameArb, (type, name) => {
          const schema: PPLColumn[] = [{ name, type }];
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          
          expect(analysis.geoColumns).toContain(name);
        }),
        { numRuns: 100 }
      );
    });

    it('should detect lat/lon column pairs as geo columns', () => {
      fc.assert(
        fc.property(latColumnNameArb, lonColumnNameArb, (latName, lonName) => {
          const schema: PPLColumn[] = [
            { name: latName, type: 'float' },
            { name: lonName, type: 'float' },
          ];
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          
          expect(analysis.geoColumns).toContain(latName);
          expect(analysis.geoColumns).toContain(lonName);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Dimension Column Classification', () => {
    it('should classify string/keyword/text types as dimensions', () => {
      fc.assert(
        fc.property(stringTypeArb, (type) => {
          expect(isStringType(type)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should classify string columns as dimensions in schema analysis', () => {
      fc.assert(
        fc.property(stringTypeArb, columnNameArb, (type, name) => {
          const schema: PPLColumn[] = [{ name, type }];
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          
          expect(analysis.dimensions).toContain(name);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Measure Column Classification', () => {
    it('should classify numeric types as measures', () => {
      fc.assert(
        fc.property(numericTypeArb, (type) => {
          expect(isNumericType(type)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should classify numeric columns as measures in schema analysis (with sufficient cardinality)', () => {
      fc.assert(
        fc.property(
          numericTypeArb,
          columnNameArb.filter(n => !isLatitudeColumn(n) && !isLongitudeColumn(n)),
          fc.array(fc.integer({ min: 0, max: 1000000 }), { minLength: 100, maxLength: 200 }),
          (type, name, values) => {
            const schema: PPLColumn[] = [{ name, type }];
            const rows: ConsolidatedRow[] = values.map(v => ({
              _cluster: 'cluster1',
              data: [v],
            }));
            const analysis = analyzeSchema(schema, rows);
            
            // High cardinality numeric columns should be measures
            expect(analysis.measures).toContain(name);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Schema-Based Chart Compatibility', () => {
    it('should only include compatible chart types based on schema', () => {
      const schemaArb = fc.array(
        fc.oneof(
          pplColumnArb(temporalTypeArb),
          pplColumnArb(geoTypeArb),
          pplColumnArb(numericTypeArb),
          pplColumnArb(stringTypeArb)
        ),
        { minLength: 1, maxLength: 5 }
      );

      fc.assert(
        fc.property(schemaArb, (schema) => {
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          const compatible = getCompatibleChartTypes(analysis);
          
          // Verify each compatible type has required columns
          for (const chartType of compatible) {
            switch (chartType) {
              case 'pie':
              case 'bar':
                expect(analysis.dimensions.length).toBeGreaterThan(0);
                expect(analysis.measures.length).toBeGreaterThan(0);
                break;
              case 'histogram':
                expect(analysis.temporalColumns.length).toBeGreaterThan(0);
                break;
              case 'map':
                expect(analysis.geoColumns.length).toBeGreaterThan(0);
                break;
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Pie Chart Validation', () => {
    it('should disable pie chart when missing dimension or measure', () => {
      // Schema with only temporal columns (no dimension or measure)
      fc.assert(
        fc.property(temporalTypeArb, columnNameArb, (type, name) => {
          const schema: PPLColumn[] = [{ name, type }];
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          
          const compatible = getCompatibleChartTypes(analysis);
          expect(compatible).not.toContain('pie');
          
          const reason = getDisabledReason(analysis, 'pie');
          expect(reason).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should enable pie chart when dimension and measure present', () => {
      fc.assert(
        fc.property(
          stringTypeArb,
          numericTypeArb,
          columnNameArb,
          columnNameArb.filter(n => !isLatitudeColumn(n) && !isLongitudeColumn(n)),
          (dimType, measType, dimName, measName) => {
            fc.pre(dimName !== measName);
            
            const schema: PPLColumn[] = [
              { name: dimName, type: dimType },
              { name: measName, type: measType },
            ];
            const rows: ConsolidatedRow[] = [];
            const analysis = analyzeSchema(schema, rows);
            
            const compatible = getCompatibleChartTypes(analysis);
            expect(compatible).toContain('pie');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Bar Chart Validation', () => {
    it('should disable bar chart when missing dimension or measure', () => {
      fc.assert(
        fc.property(temporalTypeArb, columnNameArb, (type, name) => {
          const schema: PPLColumn[] = [{ name, type }];
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          
          const compatible = getCompatibleChartTypes(analysis);
          expect(compatible).not.toContain('bar');
        }),
        { numRuns: 100 }
      );
    });

    it('should enable bar chart when dimension and measure present', () => {
      fc.assert(
        fc.property(
          stringTypeArb,
          numericTypeArb,
          columnNameArb,
          columnNameArb.filter(n => !isLatitudeColumn(n) && !isLongitudeColumn(n)),
          (dimType, measType, dimName, measName) => {
            fc.pre(dimName !== measName);
            
            const schema: PPLColumn[] = [
              { name: dimName, type: dimType },
              { name: measName, type: measType },
            ];
            const rows: ConsolidatedRow[] = [];
            const analysis = analyzeSchema(schema, rows);
            
            const compatible = getCompatibleChartTypes(analysis);
            expect(compatible).toContain('bar');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Histogram Validation', () => {
    it('should disable histogram when no temporal column', () => {
      fc.assert(
        fc.property(
          stringTypeArb,
          numericTypeArb,
          columnNameArb,
          columnNameArb.filter(n => !isLatitudeColumn(n) && !isLongitudeColumn(n)),
          (dimType, measType, dimName, measName) => {
            fc.pre(dimName !== measName);
            
            const schema: PPLColumn[] = [
              { name: dimName, type: dimType },
              { name: measName, type: measType },
            ];
            const rows: ConsolidatedRow[] = [];
            const analysis = analyzeSchema(schema, rows);
            
            const compatible = getCompatibleChartTypes(analysis);
            expect(compatible).not.toContain('histogram');
            
            const reason = getDisabledReason(analysis, 'histogram');
            expect(reason).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enable histogram when temporal column present', () => {
      fc.assert(
        fc.property(temporalTypeArb, columnNameArb, (type, name) => {
          const schema: PPLColumn[] = [{ name, type }];
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          
          const compatible = getCompatibleChartTypes(analysis);
          expect(compatible).toContain('histogram');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: Map Validation', () => {
    it('should disable map when no geo columns', () => {
      fc.assert(
        fc.property(
          stringTypeArb,
          columnNameArb.filter(n => !isLatitudeColumn(n) && !isLongitudeColumn(n)),
          (type, name) => {
            const schema: PPLColumn[] = [{ name, type }];
            const rows: ConsolidatedRow[] = [];
            const analysis = analyzeSchema(schema, rows);
            
            const compatible = getCompatibleChartTypes(analysis);
            expect(compatible).not.toContain('map');
            
            const reason = getDisabledReason(analysis, 'map');
            expect(reason).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enable map when geo_point column present', () => {
      fc.assert(
        fc.property(geoTypeArb, columnNameArb, (type, name) => {
          const schema: PPLColumn[] = [{ name, type }];
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          
          const compatible = getCompatibleChartTypes(analysis);
          expect(compatible).toContain('map');
        }),
        { numRuns: 100 }
      );
    });

    it('should enable map when lat/lon columns present', () => {
      fc.assert(
        fc.property(latColumnNameArb, lonColumnNameArb, (latName, lonName) => {
          const schema: PPLColumn[] = [
            { name: latName, type: 'float' },
            { name: lonName, type: 'float' },
          ];
          const rows: ConsolidatedRow[] = [];
          const analysis = analyzeSchema(schema, rows);
          
          const compatible = getCompatibleChartTypes(analysis);
          expect(compatible).toContain('map');
        }),
        { numRuns: 100 }
      );
    });
  });
});

// Retain the shrunk counterexample from seed -1047862008.
it('does not treat string coordinate names as geographic columns', () => {
  const analysis = analyzeSchema([{ name: 'lOn', type: 'string' }, { name: '!', type: 'integer' }], []);
  expect(getCompatibleChartTypes(analysis)).toContain('bar');
  expect(analysis.geoColumns).toEqual([]);
  const categoricalPair = analyzeSchema([{ name: 'lat', type: 'string' }, { name: 'lon', type: 'string' }], []);
  expect(categoricalPair.dimensions).toEqual(['lat', 'lon']);
  expect(getCompatibleChartTypes(categoricalPair)).not.toContain('map');
});
