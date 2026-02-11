CREATE TABLE IF NOT EXISTS mart_zip_dashboard_series (
  zip_code CHAR(5) NOT NULL REFERENCES dim_zip(zip_code),
  property_type_key TEXT NOT NULL REFERENCES dim_property_type(property_type_key),
  period_begin DATE NOT NULL,
  period_end DATE NOT NULL,
  median_sale_price NUMERIC NULL,
  median_list_price NUMERIC NULL,
  homes_sold INTEGER NULL,
  new_listings INTEGER NULL,
  avg_sale_to_list NUMERIC NULL,
  sold_above_list NUMERIC NULL,
  median_sale_price_mom NUMERIC NULL,
  median_sale_price_yoy NUMERIC NULL,
  median_list_price_mom NUMERIC NULL,
  median_list_price_yoy NUMERIC NULL,
  homes_sold_yoy NUMERIC NULL,
  new_listings_yoy NUMERIC NULL,
  avg_sale_to_list_yoy NUMERIC NULL,
  sold_above_list_yoy NUMERIC NULL,
  source_last_updated TIMESTAMPTZ NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (zip_code, property_type_key, period_end),
  CONSTRAINT mart_zip_dashboard_series_period_bounds CHECK (period_end >= period_begin)
);

CREATE INDEX IF NOT EXISTS idx_mart_zip_dashboard_series_zip_property_period_end_desc
  ON mart_zip_dashboard_series (zip_code, property_type_key, period_end DESC);

CREATE OR REPLACE FUNCTION zipmarket_competitiveness_score(
  avg_sale_to_list_input NUMERIC,
  sold_above_list_input NUMERIC,
  new_listings_yoy_input NUMERIC,
  homes_sold_yoy_input NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_score INTEGER := 0;
BEGIN
  IF avg_sale_to_list_input IS NULL OR sold_above_list_input IS NULL THEN
    RETURN NULL;
  END IF;

  total_score := total_score + CASE
    WHEN avg_sale_to_list_input >= 1.05 THEN 3
    WHEN avg_sale_to_list_input >= 1.02 THEN 2
    WHEN avg_sale_to_list_input >= 1.00 THEN 1
    WHEN avg_sale_to_list_input >= 0.98 THEN 0
    ELSE -1
  END;

  total_score := total_score + CASE
    WHEN sold_above_list_input >= 0.60 THEN 3
    WHEN sold_above_list_input >= 0.45 THEN 2
    WHEN sold_above_list_input >= 0.30 THEN 1
    WHEN sold_above_list_input >= 0.15 THEN 0
    ELSE -1
  END;

  IF new_listings_yoy_input IS NOT NULL THEN
    total_score := total_score + CASE
      WHEN new_listings_yoy_input <= -0.15 THEN 2
      WHEN new_listings_yoy_input <= -0.05 THEN 1
      WHEN new_listings_yoy_input < 0.05 THEN 0
      WHEN new_listings_yoy_input < 0.15 THEN -1
      ELSE -2
    END;
  END IF;

  IF homes_sold_yoy_input IS NOT NULL THEN
    total_score := total_score + CASE
      WHEN homes_sold_yoy_input >= 0.10 THEN 1
      WHEN homes_sold_yoy_input <= -0.10 THEN -1
      ELSE 0
    END;
  END IF;

  RETURN total_score;
END;
$$;

CREATE OR REPLACE FUNCTION zipmarket_competitiveness_label(total_score INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF total_score IS NULL THEN
    RETURN NULL;
  END IF;

  IF total_score <= 0 THEN
    RETURN 'Buyer-leaning';
  END IF;

  IF total_score <= 3 THEN
    RETURN 'Balanced';
  END IF;

  IF total_score <= 6 THEN
    RETURN 'Competitive';
  END IF;

  RETURN 'Very competitive';
END;
$$;

CREATE OR REPLACE FUNCTION zipmarket_competitiveness_explanation(
  avg_sale_to_list_input NUMERIC,
  sold_above_list_input NUMERIC,
  new_listings_yoy_input NUMERIC,
  homes_sold_yoy_input NUMERIC
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  fragments TEXT[] := ARRAY[]::TEXT[];
  explanation TEXT;
BEGIN
  IF sold_above_list_input IS NOT NULL THEN
    IF sold_above_list_input >= 0.60 THEN
      fragments := array_append(fragments, 'Most homes are selling over list.');
    ELSIF sold_above_list_input >= 0.30 THEN
      fragments := array_append(fragments, 'A meaningful share of homes are selling over list.');
    ELSIF sold_above_list_input < 0.15 THEN
      fragments := array_append(fragments, 'Few homes are selling over list.');
    END IF;
  END IF;

  IF avg_sale_to_list_input IS NOT NULL THEN
    IF avg_sale_to_list_input >= 1.00 THEN
      fragments := array_append(fragments, 'Prices are landing at/above asking.');
    ELSIF avg_sale_to_list_input < 0.98 THEN
      fragments := array_append(fragments, 'Prices are usually landing below asking.');
    END IF;
  END IF;

  IF new_listings_yoy_input IS NOT NULL THEN
    IF new_listings_yoy_input <= -0.05 THEN
      fragments := array_append(fragments, 'New listings are down from last year.');
    ELSIF new_listings_yoy_input >= 0.05 THEN
      fragments := array_append(fragments, 'New listings are up from last year.');
    END IF;
  END IF;

  IF homes_sold_yoy_input IS NOT NULL THEN
    IF homes_sold_yoy_input >= 0.10 THEN
      fragments := array_append(fragments, 'Sales activity is rising year over year.');
    ELSIF homes_sold_yoy_input <= -0.10 THEN
      fragments := array_append(fragments, 'Sales activity is falling year over year.');
    END IF;
  END IF;

  IF COALESCE(array_length(fragments, 1), 0) = 0 THEN
    RETURN 'Recent trends are mixed with no dominant signal.';
  END IF;

  explanation := fragments[1];
  IF COALESCE(array_length(fragments, 1), 0) > 1 THEN
    explanation := explanation || ' ' || fragments[2];
  END IF;

  IF char_length(explanation) > 180 THEN
    RETURN left(explanation, 177) || '...';
  END IF;

  RETURN explanation;
END;
$$;

CREATE OR REPLACE FUNCTION zipmarket_confidence_tier(
  trailing_month_count INTEGER,
  core_metrics_complete BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF trailing_month_count >= 36 AND core_metrics_complete THEN
    RETURN 'high';
  END IF;

  IF trailing_month_count >= 30 AND core_metrics_complete THEN
    RETURN 'medium';
  END IF;

  IF trailing_month_count >= 24 THEN
    RETURN 'low';
  END IF;

  RETURN 'insufficient';
END;
$$;

CREATE OR REPLACE FUNCTION refresh_zipmarket_marts()
RETURNS TABLE(updated_zip_rows INTEGER, latest_rows INTEGER, series_rows INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  latest_period_end DATE;
  v_updated_zip_rows INTEGER := 0;
  v_latest_rows INTEGER := 0;
  v_series_rows INTEGER := 0;
BEGIN
  SELECT MAX(period_end)
  INTO latest_period_end
  FROM fact_zip_market_monthly
  WHERE property_type_key = 'all';

  WITH latest_all AS (
    SELECT
      fact.zip_code,
      fact.median_sale_price,
      fact.homes_sold,
      fact.avg_sale_to_list,
      fact.sold_above_list
    FROM fact_zip_market_monthly fact
    WHERE latest_period_end IS NOT NULL
      AND fact.property_type_key = 'all'
      AND fact.period_end = latest_period_end
  ),
  trailing_history AS (
    SELECT
      fact.zip_code,
      COUNT(*)::INTEGER AS trailing_month_count
    FROM fact_zip_market_monthly fact
    WHERE latest_period_end IS NOT NULL
      AND fact.property_type_key = 'all'
      AND fact.period_end BETWEEN (latest_period_end - INTERVAL '35 months')::DATE AND latest_period_end
    GROUP BY fact.zip_code
  ),
  support_eval AS (
    SELECT
      zip.zip_code,
      CASE
        WHEN NOT zip.is_nj THEN FALSE
        WHEN latest_period_end IS NULL THEN FALSE
        WHEN latest_all.zip_code IS NULL THEN FALSE
        WHEN COALESCE(trailing_history.trailing_month_count, 0) < 24 THEN FALSE
        WHEN latest_all.median_sale_price IS NULL
          OR latest_all.homes_sold IS NULL
          OR latest_all.avg_sale_to_list IS NULL
          OR latest_all.sold_above_list IS NULL
          THEN FALSE
        ELSE TRUE
      END AS is_supported,
      CASE
        WHEN NOT zip.is_nj THEN 'non_nj_zip'
        WHEN latest_period_end IS NULL THEN 'no_recent_data'
        WHEN latest_all.zip_code IS NULL THEN 'no_recent_data'
        WHEN COALESCE(trailing_history.trailing_month_count, 0) < 24 THEN 'insufficient_history'
        WHEN latest_all.median_sale_price IS NULL
          OR latest_all.homes_sold IS NULL
          OR latest_all.avg_sale_to_list IS NULL
          OR latest_all.sold_above_list IS NULL
          THEN 'missing_core_metrics'
        ELSE NULL
      END AS support_reason
    FROM dim_zip zip
    LEFT JOIN latest_all
      ON latest_all.zip_code = zip.zip_code
    LEFT JOIN trailing_history
      ON trailing_history.zip_code = zip.zip_code
  )
  UPDATE dim_zip zip
  SET
    is_supported = support_eval.is_supported,
    support_reason = support_eval.support_reason,
    updated_at = NOW()
  FROM support_eval
  WHERE zip.zip_code = support_eval.zip_code
    AND (
      zip.is_supported IS DISTINCT FROM support_eval.is_supported
      OR zip.support_reason IS DISTINCT FROM support_eval.support_reason
    );

  GET DIAGNOSTICS v_updated_zip_rows = ROW_COUNT;

  TRUNCATE TABLE mart_zip_dashboard_latest;

  WITH latest_snapshot AS (
    SELECT DISTINCT ON (fact.zip_code, fact.property_type_key)
      fact.zip_code,
      fact.property_type_key,
      fact.period_end,
      fact.median_sale_price,
      fact.median_list_price,
      fact.homes_sold,
      fact.new_listings,
      fact.avg_sale_to_list,
      fact.sold_above_list,
      fact.median_sale_price_yoy,
      fact.median_list_price_yoy,
      fact.homes_sold_yoy,
      fact.new_listings_yoy,
      fact.avg_sale_to_list_yoy,
      fact.sold_above_list_yoy,
      fact.source_last_updated
    FROM fact_zip_market_monthly fact
    ORDER BY fact.zip_code, fact.property_type_key, fact.period_end DESC
  ),
  trailing_counts AS (
    SELECT
      latest_snapshot.zip_code,
      latest_snapshot.property_type_key,
      COUNT(*)::INTEGER AS trailing_month_count
    FROM latest_snapshot
    JOIN fact_zip_market_monthly fact
      ON fact.zip_code = latest_snapshot.zip_code
      AND fact.property_type_key = latest_snapshot.property_type_key
      AND fact.period_end BETWEEN (latest_snapshot.period_end - INTERVAL '35 months')::DATE
        AND latest_snapshot.period_end
    GROUP BY latest_snapshot.zip_code, latest_snapshot.property_type_key
  ),
  scored AS (
    SELECT
      latest_snapshot.*,
      COALESCE(trailing_counts.trailing_month_count, 0) AS trailing_month_count,
      (
        latest_snapshot.median_sale_price IS NOT NULL
        AND latest_snapshot.homes_sold IS NOT NULL
        AND latest_snapshot.avg_sale_to_list IS NOT NULL
        AND latest_snapshot.sold_above_list IS NOT NULL
      ) AS core_metrics_complete,
      zipmarket_competitiveness_score(
        latest_snapshot.avg_sale_to_list,
        latest_snapshot.sold_above_list,
        latest_snapshot.new_listings_yoy,
        latest_snapshot.homes_sold_yoy
      ) AS competitiveness_score
    FROM latest_snapshot
    LEFT JOIN trailing_counts
      ON trailing_counts.zip_code = latest_snapshot.zip_code
      AND trailing_counts.property_type_key = latest_snapshot.property_type_key
  )
  INSERT INTO mart_zip_dashboard_latest (
    zip_code,
    property_type_key,
    period_end,
    median_sale_price,
    median_list_price,
    homes_sold,
    new_listings,
    avg_sale_to_list,
    sold_above_list,
    median_sale_price_yoy,
    median_list_price_yoy,
    homes_sold_yoy,
    new_listings_yoy,
    avg_sale_to_list_yoy,
    sold_above_list_yoy,
    sale_to_list_pct_over_under,
    competitiveness_score,
    competitiveness_label,
    competitiveness_explanation,
    confidence_tier,
    source_last_updated,
    refreshed_at
  )
  SELECT
    scored.zip_code,
    scored.property_type_key,
    scored.period_end,
    scored.median_sale_price,
    scored.median_list_price,
    scored.homes_sold,
    scored.new_listings,
    scored.avg_sale_to_list,
    scored.sold_above_list,
    scored.median_sale_price_yoy,
    scored.median_list_price_yoy,
    scored.homes_sold_yoy,
    scored.new_listings_yoy,
    scored.avg_sale_to_list_yoy,
    scored.sold_above_list_yoy,
    CASE
      WHEN scored.avg_sale_to_list IS NULL THEN NULL
      ELSE ((scored.avg_sale_to_list - 1) * 100)::NUMERIC
    END AS sale_to_list_pct_over_under,
    scored.competitiveness_score,
    zipmarket_competitiveness_label(scored.competitiveness_score),
    CASE
      WHEN scored.competitiveness_score IS NULL THEN NULL
      ELSE zipmarket_competitiveness_explanation(
        scored.avg_sale_to_list,
        scored.sold_above_list,
        scored.new_listings_yoy,
        scored.homes_sold_yoy
      )
    END AS competitiveness_explanation,
    zipmarket_confidence_tier(scored.trailing_month_count, scored.core_metrics_complete),
    scored.source_last_updated,
    NOW()
  FROM scored;

  GET DIAGNOSTICS v_latest_rows = ROW_COUNT;

  TRUNCATE TABLE mart_zip_dashboard_series;

  IF latest_period_end IS NOT NULL THEN
    INSERT INTO mart_zip_dashboard_series (
      zip_code,
      property_type_key,
      period_begin,
      period_end,
      median_sale_price,
      median_list_price,
      homes_sold,
      new_listings,
      avg_sale_to_list,
      sold_above_list,
      median_sale_price_mom,
      median_sale_price_yoy,
      median_list_price_mom,
      median_list_price_yoy,
      homes_sold_yoy,
      new_listings_yoy,
      avg_sale_to_list_yoy,
      sold_above_list_yoy,
      source_last_updated,
      refreshed_at
    )
    SELECT
      fact.zip_code,
      fact.property_type_key,
      fact.period_begin,
      fact.period_end,
      fact.median_sale_price,
      fact.median_list_price,
      fact.homes_sold,
      fact.new_listings,
      fact.avg_sale_to_list,
      fact.sold_above_list,
      fact.median_sale_price_mom,
      fact.median_sale_price_yoy,
      fact.median_list_price_mom,
      fact.median_list_price_yoy,
      fact.homes_sold_yoy,
      fact.new_listings_yoy,
      fact.avg_sale_to_list_yoy,
      fact.sold_above_list_yoy,
      fact.source_last_updated,
      NOW()
    FROM fact_zip_market_monthly fact
    WHERE fact.period_end BETWEEN (latest_period_end - INTERVAL '35 months')::DATE AND latest_period_end;

    GET DIAGNOSTICS v_series_rows = ROW_COUNT;
  END IF;

  RETURN QUERY
  SELECT v_updated_zip_rows, v_latest_rows, v_series_rows;
END;
$$;

CREATE OR REPLACE FUNCTION find_nearest_supported_zips(
  input_zip CHAR(5),
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE(zip_code CHAR(5), distance_miles DOUBLE PRECISION)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_input_zip TEXT := BTRIM(input_zip);
  input_geog GEOGRAPHY(POINT, 4326);
  bounded_max_results INTEGER := GREATEST(COALESCE(max_results, 5), 1);
BEGIN
  SELECT zip.geog
  INTO input_geog
  FROM dim_zip zip
  WHERE BTRIM(zip.zip_code) = normalized_input_zip
  LIMIT 1;

  IF input_geog IS NOT NULL THEN
    RETURN QUERY
    SELECT
      zip.zip_code,
      ROUND((ST_Distance(input_geog, zip.geog) / 1609.344)::NUMERIC, 2)::DOUBLE PRECISION
        AS distance_miles
    FROM dim_zip zip
    WHERE zip.is_nj = TRUE
      AND zip.is_supported = TRUE
      AND zip.geog IS NOT NULL
      AND BTRIM(zip.zip_code) <> normalized_input_zip
    ORDER BY ST_Distance(input_geog, zip.geog), zip.zip_code
    LIMIT bounded_max_results;

    RETURN;
  END IF;

  IF normalized_input_zip !~ '^[0-9]{5}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    zip.zip_code,
    ABS(BTRIM(zip.zip_code)::INTEGER - normalized_input_zip::INTEGER)::DOUBLE PRECISION
      AS distance_miles
  FROM dim_zip zip
  WHERE zip.is_nj = TRUE
    AND zip.is_supported = TRUE
    AND BTRIM(zip.zip_code) <> normalized_input_zip
  ORDER BY ABS(BTRIM(zip.zip_code)::INTEGER - normalized_input_zip::INTEGER), zip.zip_code
  LIMIT bounded_max_results;
END;
$$;
