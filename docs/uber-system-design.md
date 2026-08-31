# Ride-Sharing Service (Uber) System Design Summary

> Source: Hello Interview — "Design a Ride-Sharing Service Like Uber"

---

## 1. Requirements Gathering

### Functional Requirements
- **Get a fare estimate** — riders input a start location and destination and get an estimated fare
- **Request a ride** — riders request a ride based on the estimated fare
- **Match with a driver** — on request, riders are matched with a nearby, available driver
- **Accept / decline and navigate** — drivers accept or decline a request and navigate to pickup/drop-off

### Non-Functional Requirements
- **Low latency matching** — under 1 minute to match, or a clear failure
- **Strong consistency in matching** — no driver is ever assigned two rides at once
- **High throughput** — handle surges (e.g. 100K requests from the same location during a special event)

---

## 2. Core Entities

### Rider
- `id`, `name`, contact details, preferred payment methods

### Driver
- `id`, personal details, vehicle info (make, model, year), availability status

### Fare
- pickup location, destination, estimated fare, estimated time of arrival — kept as its own entity separate from `Ride` so an estimate can exist before a ride is confirmed

### Ride
- rider id, driver id, vehicle details, status, planned route, actual fare, pickup/drop-off timestamps

### Location
- driver id, latitude/longitude, last-updated timestamp — the real-time signal that matching depends on

---

## 3. High-Level Architecture

```
Rider Client ─┐
              ├─→ API Gateway (auth, rate limiting, routing) ─→ Ride Service ─→ DB (Fare, Ride)
Driver Client ┘         │                                            │              │
                         │                                     trigger matching   3rd-party
                         │                                            ↓          Mapping API
                         │                                   Ride Matching Service
                         │                                            │
                         │                                     get nearby drivers
                         │                                            ↓
                         └────────── update location ──────→ Location Service
                                                                       │
                                                              Notification Service
                                                              (APNs / FCM) → driver
```

### Key Components
| Component | Responsibility |
|-----------|-----------------|
| **API Gateway** | Entry point for both clients — auth, rate limiting, routing |
| **Ride Service** | Calculates fare estimates (via the mapping API), creates `Fare`/`Ride` records, triggers the matching workflow |
| **Ride Matching Service** | Finds nearby, available drivers and assigns the best match — proximity, availability, rating |
| **Location Service** | Ingests driver location pings and serves "nearest drivers" queries to the matching service |
| **Notification Service** | Pushes the ride request to the matched driver via APNs (iOS) / FCM (Android) |
| **3rd-Party Mapping API** | Distance/travel-time calculation the Ride Service uses to price a fare |

---

## 4. Key Data Flows

### Fare Estimate
1. Rider enters pickup + destination → `POST /fare`
2. Ride Service calls the mapping API for distance/time, applies the pricing model
3. Ride Service creates a `Fare` record and returns it to the rider

### Request a Ride → Matching
1. Rider confirms → `POST /rides` with the `fareId`
2. Ride Service creates a `Ride` (status `requested`) and triggers the matching workflow
3. Ride Matching Service queries the Location Service for nearby, available drivers and picks the best match
4. Notification Service pushes the request to the top-ranked driver

### Driver Accept
1. Driver accepts → `PATCH /rides/:rideId`
2. Ride Service updates status to `accepted`, assigns the driver, returns pickup coordinates
3. Driver client navigates using on-device GPS
4. If the driver doesn't respond within a timeout, the request moves to the next driver on the ranked list (a multi-step/human-in-the-loop process — Uber's own Cadence/Temporal was built for exactly this kind of workflow)

---

## 5. Deep Dives

### Handling Driver Location at Scale
~10M drivers pinging every ~5 seconds is ~2M writes/second — enough to fall over a general-purpose database, and lat/long doesn't index well in a plain B-tree anyway (poor fit for proximity search).
- **Great solution**: a real-time, in-memory geospatial data store (e.g. Redis geospatial commands) built for exactly this — fast writes, native "nearby" queries
- **Client-side complement**: adaptive location-update intervals — an idle or slow-moving driver doesn't need a ping every 5 seconds; let the client reduce frequency based on on-device sensors
- At real scale, a single geospatial store won't hold 10M drivers either — it gets [sharded](sharding.md), typically by geographic region (a natural, query-aligned key: a driver in Mumbai is never matched against a rider in Tokyo), with [consistent hashing](consistent-hashing.md) so adding a region-shard doesn't reshuffle every driver's data

### Preventing Double-Assignment of a Driver
Same shape as [Ticketmaster's double-booking problem](ticketmaster-system-design.md#4-preventing-double-booking-critical-concept): two ride requests must never lock the same driver at once.
- **Great solution**: a distributed lock with a TTL on the driver, released on accept/decline or auto-expired if the driver doesn't respond — the driver gets ~10 seconds to accept before the system moves on

### No Dropped Requests During Peak Demand
A burst of requests (a concert letting out, a holiday) can overwhelm the Ride Matching Service, and an instance crash shouldn't silently drop in-flight rides either.
- **Great solution**: a queue in front of matching with dynamic scaling on the consumer side, instead of processing requests synchronously and dropping what doesn't fit

---

## 6. Key Technical Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|-----------------|
| **Driver location storage** | General-purpose DB (Postgres/DynamoDB) | In-memory geospatial store (Redis) | Redis — write volume and proximity queries both demand it |
| **Location update frequency** | Fixed interval (every 5s) | Adaptive, client-driven | Adaptive — cuts ping volume without losing accuracy where it matters |
| **Driver assignment locking** | App-level checks | Distributed lock with TTL | TTL lock — auto-releases on timeout, no manual cleanup |
| **Peak-load handling** | Synchronous, first-come-first-served | Queue + dynamic scaling | Queue — absorbs bursts instead of dropping requests |

---

## Quick Reference: Technologies Used

| Technology | Use Case |
|------------|----------|
| Redis (geospatial) | Driver location storage, proximity ("nearby drivers") queries |
| Distributed lock (TTL) | Prevents a driver from being assigned two rides at once |
| Queue + autoscaling | Absorbs ride-request bursts during peak demand |
| APNs / FCM | Push notifications to the driver app |
| 3rd-party mapping API | Distance/ETA calculation for fare estimation |
