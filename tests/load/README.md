# Load Testing

This directory contains load testing scripts using [k6](https://k6.io/).

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6

# Or via Docker
docker pull grafana/k6
```

## Running Load Tests

### Basic Load Test

```bash
# Run against local development server
k6 run tests/load/api-load-test.js

# Run against production
k6 run -e BASE_URL=https://your-app.vercel.app tests/load/api-load-test.js

# Run with custom API key
k6 run -e BASE_URL=http://localhost:3000 -e API_KEY=your_api_key tests/load/api-load-test.js
```

### Using Docker

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:3000 \
  -e API_KEY=your_api_key \
  grafana/k6 run - < tests/load/api-load-test.js
```

## Test Scenarios

The load test includes the following scenarios:

1. **Health Check** - Verifies API availability
2. **List Members** - Tests GET /api/v1/members
3. **Create Member** - Tests POST /api/v1/members
4. **List Leads** - Tests GET /api/v1/leads
5. **List Attendance** - Tests GET /api/v1/attendance

## Load Profile

The test follows this load profile:

- **Ramp up to 20 VUs** (30s)
- **Stay at 20 VUs** (1m)
- **Ramp up to 50 VUs** (30s)
- **Stay at 50 VUs** (1m)
- **Ramp up to 100 VUs** (30s)
- **Stay at 100 VUs** (1m)
- **Ramp down to 0 VUs** (30s)

**Total Duration:** ~5 minutes

## Performance Thresholds

The test enforces the following thresholds:

- **95% of requests < 500ms**
- **Less than 1% request failure rate**
- **At least 90% API request success rate**
- **95% of API responses < 1s**

## Interpreting Results

### Key Metrics

- **http_req_duration**: Time taken for HTTP requests
- **http_req_failed**: Rate of failed requests
- **api_requests**: Rate of successful API requests
- **api_response_time**: API-specific response times

### Sample Output

```
=== Load Test Results ===

Duration: 300s
Iterations: 1500
VUs Max: 100

HTTP Metrics:
  Requests: 7500
  Failed: 0.12%
  Avg Response Time: 245.67ms
  P95 Response Time: 487.23ms
  P99 Response Time: 892.45ms

API Metrics:
  Success Rate: 99.88%
  Avg Response Time: 267.89ms
```

## Custom Load Profiles

Create custom load profiles by modifying the `options.stages` array:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp to 50 users in 1 minute
    { duration: '5m', target: 50 },   // Stay at 50 users for 5 minutes
    { duration: '1m', target: 0 },    // Ramp down in 1 minute
  ],
};
```

## Troubleshooting

### Connection Refused

Ensure your application is running:

```bash
npm run dev
# or
npm run build && npm start
```

### Authentication Errors

Verify your API key is valid and has the required scopes.

### High Failure Rate

Check application logs for errors and consider:

- Database connection pool size
- Redis connection limits
- Server resource limits (CPU, memory)

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 HTTP API](https://k6.io/docs/javascript-api/k6-http/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
