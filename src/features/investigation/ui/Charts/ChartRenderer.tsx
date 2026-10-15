// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * ChartRenderer component - renders the appropriate chart based on config type
 * Requirements: 2.2
 */

import React from 'react';
import type { PPLColumn } from '../../../../types/cell';
import type { ConsolidatedRow } from '../../../../types/investigation';
import type { ChartConfig, ChartColorPalette, PieChartConfig, BarChartConfig, HistogramConfig, GeoMapConfig } from '../../../../types/chart';
import { PieChart } from './PieChart';
import { BarChart } from './BarChart';
import { Histogram } from './Histogram';
import { GeoMap } from './GeoMap';
import {
  mapToPieData,
  mapToPieDataByCluster,
  mapToBarData,
  mapToHistogramData,
  mapToGeoData,
} from '../../../../services/chartDataMapper';

interface ChartRendererProps {
  config: ChartConfig;
  rows: ConsolidatedRow[];
  schema: PPLColumn[];
  palette: ChartColorPalette;
  width: number;
  height: number;
}

export function ChartRenderer({
  config,
  rows,
  schema,
  palette,
  width,
  height,
}: ChartRendererProps): React.ReactElement {
  switch (config.type) {
    case 'pie': {
      const pieConfig = config as PieChartConfig;
      // Use cluster grouping if dimension is _cluster
      const data = pieConfig.dimensionColumn === '_cluster'
        ? mapToPieDataByCluster(rows, pieConfig, schema)
        : mapToPieData(rows, pieConfig, schema);
      return (
        <PieChart
          data={data}
          config={pieConfig}
          palette={palette}
          width={width}
          height={height}
        />
      );
    }
    
    case 'bar': {
      const barConfig = config as BarChartConfig;
      const data = mapToBarData(rows, barConfig, schema);
      return (
        <BarChart
          data={data}
          config={barConfig}
          palette={palette}
          width={width}
          height={height}
        />
      );
    }
    
    case 'histogram': {
      const histConfig = config as HistogramConfig;
      const data = mapToHistogramData(rows, histConfig, schema);
      return (
        <Histogram
          data={data}
          config={histConfig}
          palette={palette}
          width={width}
          height={height}
        />
      );
    }
    
    case 'map': {
      const mapConfig = config as GeoMapConfig;
      const data = mapToGeoData(rows, mapConfig, schema);
      return (
        <GeoMap
          data={data}
          config={mapConfig}
          palette={palette}
          width={width}
          height={height}
        />
      );
    }
  }
}

export default ChartRenderer;
