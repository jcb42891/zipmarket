
Product Requirements Document (PRD)
Product Name (Working)

ZipMarket (placeholder)

One-line Value Proposition

“Instantly understand how competitive a NJ ZIP code housing market really is — what homes list for, sell for, and how aggressive buyers need to be.”

🎯 Problem Statement

Homebuyers struggle to understand how competitive a housing market is in a specific ZIP code. While listing portals show individual homes, they do not answer higher-level questions like:

What do homes generally list for vs sell for here?

How much over asking do buyers typically need to bid?

Is inventory improving or tightening?

Are certain types of homes (e.g., 3-bed SFHs) driving competition?

Buyers end up relying on anecdotes, outdated advice, or overfitting from a handful of listings.

🧑‍🎯 Target User

Primary:

Homebuyers in New Jersey (first-time or repeat)

Budget-constrained buyers trying to plan bidding strategy

Secondary:

Buyers working with an agent who want independent market context

Curious homeowners tracking their ZIP’s competitiveness

🚧 Non-Goals (Explicit)

This product is not:

A listings search engine

A real-time view of active homes

A replacement for MLS or Zillow/Redfin listing pages

A tool that recommends bids on individual properties

🧠 Core Product Concept

A dynamic ZIP-based dashboard that loads instantly when a user enters a ZIP code and shows market-level pricing, inventory, and competitiveness trends, with optional sold-only segmentation.

🛠 MVP Feature Scope
1️⃣ ZIP Search & Dashboard Load

User Story

As a user, I can enter a NJ ZIP code and instantly see a dashboard of housing market metrics for that ZIP.

Requirements

Accept 5-digit ZIP input

Validate ZIP belongs to NJ

If unsupported → show graceful “Data not available yet” state with nearby ZIP suggestions

Dashboard loads without pagination or secondary steps

2️⃣ Median List Price (Trend)

Definition

Median asking/list price for homes in the ZIP, aggregated monthly

Display

Line chart (last 24–36 months)

Latest value shown as headline KPI

MoM and YoY deltas

Notes

Represents market-level list behavior, not current active listings

3️⃣ Median Sale Price (Trend)

Definition

Median closed sale price for homes in the ZIP, aggregated monthly

Display

Line chart aligned with list price chart

Latest value + YoY delta

Optional overlay vs list price

Notes

Based on closed sales / public records

Strongest signal in the product

4️⃣ Sale-to-List Ratio

Definition

Sale-to-List Ratio = Sale Price / List Price


Display

Latest rolling value (e.g., last 90 days)

Trend over time (monthly)

Expressed as:

Ratio (e.g., 1.021)

Percentage over/under list (e.g., +2.1%)

5️⃣ % Sold Over List

Definition

% Sold Over List = (# homes with SalePrice > ListPrice) / (Total sold)


Display

Latest rolling percentage (90 days)

Trend over time (monthly)

Used to support competitiveness interpretation

6️⃣ New Listings per Month

Definition

Count of newly listed homes in the ZIP during each month (aggregate)

Display

Bar or line chart

Trend vs prior year

Supports “how often do opportunities appear?”

Important

Not a real-time inventory count

Clearly labeled as historical listing activity

7️⃣ Sales Volume

Definition

Number of closed sales per month in the ZIP

Display

Monthly bar chart

YoY comparison

Used to contextualize price trends (thin vs liquid markets)

8️⃣ Market Competitiveness Indicator (Derived)

Purpose
Provide a simple, buyer-friendly summary of how competitive the market is.

Inputs

Sale-to-list ratio

% sold over list

New listings trend

Sales volume trend

Output

Qualitative label:

Buyer-leaning

Balanced

Competitive

Very competitive

Short explanation text:

“Most homes sell over list and inventory is tight relative to last year.”

Important

Heuristic-based

Clearly labeled as an indicator, not a prediction

🔎 Optional Segmentation (Sold-Only)
Supported Segments (MVP)

Segmentation applies only to closed sales, not active listings.

Segment dimensions

Bedrooms:

2 beds

3 beds

4+ beds

Property type:

Single-family home

Condo / townhome

Price bands:

Derived per ZIP (e.g., quartiles or fixed ranges)

User Interaction

Dropdown or toggle filters

Default = “All homes”

Applying a segment updates:

Median sale price

Sale-to-list ratio

% sold over list

Sales volume

Explicit Limitation

Inventory & new listings remain unsegmented in MVP

⚠️ Disclaimers & Trust Signals (Required)
Persistent Disclaimer Block

Displayed on every ZIP dashboard:

“This dashboard is based on closed sales and aggregated market data.
It is not a live listings feed and does not reflect currently active homes.”

Metric-Level Tooltips

Examples:

“Sale-to-list ratio reflects historical closed sales.”

“New listings represent historical listing activity, not current inventory.”

🧱 Data & Technical Assumptions (High-Level)

NJ-only coverage for MVP

Data refreshed weekly or monthly

ZIP-level + sold-only segmentation

Precomputed time-series metrics (no on-request aggregation)

📊 Success Metrics (MVP)

User can load any supported NJ ZIP in <500ms

Dashboard answers:

“What do homes sell for here?”

“Is this ZIP competitive?”

“Do buyers usually bid over?”

Early qualitative validation:

“This helped me understand the market”

“This is clearer than Zillow/Redfin charts”

🚀 Future Extensions (Explicitly Out of MVP)

Active listing tracking

Real-time inventory counts

Property-level bidding recommendations

School zones, neighborhoods, street-level views

MLS-powered filters

🧭 Product Positioning Summary

ZipMarket is:

A housing market intelligence tool

For buyers planning strategy

Focused on clarity, not listings

Built on historical truth, not hype