import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const apiRequests = new Rate('api_requests');
const apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '1m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% of requests should fail
    api_requests: ['rate>0.9'],       // At least 90% of API requests should succeed
    api_response_time: ['p(95)<1000'], // 95% of API responses should be below 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test_api_key';

// Test data
const testMembers = [
  { name: 'John Doe', email: 'john@example.com' },
  { name: 'Jane Smith', email: 'jane@example.com' },
  { name: 'Bob Johnson', email: 'bob@example.com' },
];

export default function () {
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  });
  apiRequests.add(healthRes.status === 200);
  apiResponseTime.add(healthRes.timings.duration);

  sleep(0.5);

  // Test 2: List members
  const membersRes = http.get(`${BASE_URL}/api/v1/members`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  check(membersRes, {
    'members list status is 200': (r) => r.status === 200,
    'members list has data': (r) => {
      const body = r.json();
      return body.data && Array.isArray(body.data);
    },
    'members list response time < 500ms': (r) => r.timings.duration < 500,
  });
  apiRequests.add(membersRes.status === 200);
  apiResponseTime.add(membersRes.timings.duration);

  sleep(0.5);

  // Test 3: Create member (POST)
  const testMember = testMembers[Math.floor(Math.random() * testMembers.length)];
  const createMemberPayload = JSON.stringify({
    name: testMember.name,
    email: testMember.email,
    membershipType: 'basic',
  });

  const createMemberRes = http.post(`${BASE_URL}/api/v1/members`, createMemberPayload, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  check(createMemberRes, {
    'create member status is 201': (r) => r.status === 201,
    'create member returns ID': (r) => {
      const body = r.json();
      return body.data && body.data.id;
    },
    'create member response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  apiRequests.add(createMemberRes.status === 201);
  apiResponseTime.add(createMemberRes.timings.duration);

  sleep(0.5);

  // Test 4: List leads
  const leadsRes = http.get(`${BASE_URL}/api/v1/leads`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  check(leadsRes, {
    'leads list status is 200': (r) => r.status === 200,
    'leads list response time < 500ms': (r) => r.timings.duration < 500,
  });
  apiRequests.add(leadsRes.status === 200);
  apiResponseTime.add(leadsRes.timings.duration);

  sleep(0.5);

  // Test 5: List attendance
  const attendanceRes = http.get(`${BASE_URL}/api/v1/attendance`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  check(attendanceRes, {
    'attendance list status is 200': (r) => r.status === 200,
    'attendance list response time < 500ms': (r) => r.timings.duration < 500,
  });
  apiRequests.add(attendanceRes.status === 200);
  apiResponseTime.add(attendanceRes.timings.duration);

  sleep(1);
}

// Setup function (runs once before the test)
export function setup() {
  // Verify API is accessible
  const res = http.get(`${BASE_URL}/api/v1/health`);
  if (res.status !== 200) {
    throw new Error(`API health check failed: ${res.status}`);
  }
  return { startTime: Date.now() };
}

// Teardown function (runs once after the test)
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Test completed in ${duration}ms`);
}

// Handle summary output
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, opts) {
  const { metrics } = data;
  let summary = '\n=== Load Test Results ===\n\n';
  
  summary += `Duration: ${Math.round(data.state.testRunDurationMs / 1000)}s\n`;
  summary += `Iterations: ${data.metrics.iterations?.values?.count || 0}\n`;
  summary += `VUs Max: ${data.metrics.vus?.values?.max || 0}\n\n`;
  
  summary += 'HTTP Metrics:\n';
  summary += `  Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `  Failed: ${metrics.http_req_failed?.values?.rate ? (metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%\n`;
  summary += `  Avg Response Time: ${metrics.http_req_duration?.values?.avg ? metrics.http_req_duration.values.avg.toFixed(2) : 0}ms\n`;
  summary += `  P95 Response Time: ${metrics.http_req_duration?.values?.['p(95)'] ? metrics.http_req_duration.values['p(95)'].toFixed(2) : 0}ms\n`;
  summary += `  P99 Response Time: ${metrics.http_req_duration?.values?.['p(99)'] ? metrics.http_req_duration.values['p(99)'].toFixed(2) : 0}ms\n\n`;
  
  summary += 'API Metrics:\n';
  summary += `  Success Rate: ${metrics.api_requests?.values?.rate ? (metrics.api_requests.values.rate * 100).toFixed(2) : 0}%\n`;
  summary += `  Avg Response Time: ${metrics.api_response_time?.values?.avg ? metrics.api_response_time.values.avg.toFixed(2) : 0}ms\n`;
  
  return summary;
}
