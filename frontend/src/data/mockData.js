// Mock Data & Telemetry for PS: AI-Powered Business Operations Intelligence & Decision Engine

export const INITIAL_TEAMS = [
  { id: 'team-a', name: 'Team A - Payments', activeTickets: 9, maxCapacity: 10, skills: ['Payments', 'Billing', 'Refunds'], lead: 'Vikram Mehta' },
  { id: 'team-b', name: 'Team B - Payments', activeTickets: 4, maxCapacity: 10, skills: ['Payments', 'Card Processing'], lead: 'Ananya Sen' },
  { id: 'team-c', name: 'Team C - DevOps', activeTickets: 8, maxCapacity: 8, skills: ['Infrastructure', 'Cloud'], lead: 'Rohan Sharma' },
  { id: 'team-d', name: 'Team D - Support', activeTickets: 5, maxCapacity: 12, skills: ['Authentication', 'Accounts'], lead: 'Sneha Rao' }
];

export const INITIAL_TICKETS = [
  {
    id: 'T103',
    problem: 'Production Server down in US-East cluster',
    category: 'Infrastructure',
    priority: 'Critical',
    pendingHours: 1.0,
    deadlineHoursLeft: 0.5,
    assignedTeamId: 'team-c',
    status: 'Pending',
    riskScore: 98,
    riskLevel: 'High',
    flagReason: 'Critical severity with only 30 mins to SLA breach; DevOps squad is at 100% capacity.',
    evidence: [
      'Deadline is in 30 minutes (SLA threshold is 4.0h)',
      'Assigned Squad (DevOps) is at 100% capacity (8/8 concurrent tasks)',
      'Historical infrastructure outage MTTR is 1.4h (insufficient buffer)'
    ],
    suggestedAction: 'Immediate triage & alert on-call DevOps lead',
    actionType: 'Escalate',
    actionTaken: null,
    impactEstimate: 'Prevents $45k downtime & major customer outage'
  },
  {
    id: 'T104',
    problem: 'Refund delay for 45 pending merchant orders',
    category: 'Billing',
    priority: 'High',
    pendingHours: 10.0,
    deadlineHoursLeft: -2.0,
    assignedTeamId: 'team-a',
    status: 'Escalated',
    riskScore: 94,
    riskLevel: 'High',
    flagReason: 'SLA is already breached by 2 hours. Requires supervisor fast-track approval.',
    evidence: [
      'Customer deadline passed 2.0 hours ago (Breached)',
      'Pending time (10.0h) is 1.6x the category average (6.2h)',
      'Manual bank confirmation step blocked in queue'
    ],
    suggestedAction: 'Escalate to Operations Lead for bulk refund override',
    actionType: 'Escalate',
    actionTaken: null,
    impactEstimate: 'Resolves regulatory dispute & eliminates merchant penalty'
  },
  {
    id: 'T101',
    problem: 'Payment failure at checkout webhook',
    category: 'Payments',
    priority: 'High',
    pendingHours: 5.0,
    deadlineHoursLeft: 1.0,
    assignedTeamId: 'team-a',
    status: 'Pending',
    riskScore: 88,
    riskLevel: 'High',
    flagReason: 'Team A (Payments) is carrying 9 active tasks. Transferring to Team B avoids customer impact.',
    evidence: [
      'Customer deadline is in 60 minutes',
      'Team A (Payments) has 9/10 active tasks (Overloaded)',
      'Team B (Payments) has matching skill tag and 6 available slots',
      'Historical latency for Team B is 45% faster under current load'
    ],
    suggestedAction: 'Reassign to Team B (Payments) which has 6 open slots',
    actionType: 'Reassign',
    recommendedTeamId: 'team-b',
    actionTaken: null,
    impactEstimate: 'Saves ~45m turnaround time & guarantees SLA compliance'
  },
  {
    id: 'T106',
    problem: 'Double deduction on UPI transaction batch',
    category: 'Payments',
    priority: 'High',
    pendingHours: 4.5,
    deadlineHoursLeft: 1.2,
    assignedTeamId: 'team-a',
    status: 'Pending',
    riskScore: 82,
    riskLevel: 'High',
    flagReason: 'Urgent merchant impact with approaching deadline on overloaded team.',
    evidence: [
      '1.2 hours until deadline expiration',
      'Team A is at 90% capacity limit',
      'Team B has capacity to handle immediately'
    ],
    suggestedAction: 'Reassign to Team B (Payments)',
    actionType: 'Reassign',
    recommendedTeamId: 'team-b',
    actionTaken: null,
    impactEstimate: 'Protects user transaction trust & clears queue'
  },
  {
    id: 'T108',
    problem: 'Merchant settlement delayed batch job',
    category: 'Billing',
    priority: 'High',
    pendingHours: 8.0,
    deadlineHoursLeft: 0.5,
    assignedTeamId: 'team-a',
    status: 'Pending',
    riskScore: 91,
    riskLevel: 'High',
    flagReason: 'Only 30 minutes left before regulatory breach; Team A overloaded.',
    evidence: [
      'Approaching regulatory compliance deadline in 30 minutes',
      'Pending 8 hours on overloaded squad',
      'Target squad has available capacity'
    ],
    suggestedAction: 'Reassign to Team B (Payments) immediately',
    actionType: 'Reassign',
    recommendedTeamId: 'team-b',
    actionTaken: null,
    impactEstimate: 'Eliminates compliance audit breach'
  },
  {
    id: 'T102',
    problem: 'OAuth login issue on iOS app v4.2',
    category: 'Authentication',
    priority: 'Medium',
    pendingHours: 2.0,
    deadlineHoursLeft: 8.0,
    assignedTeamId: 'team-d',
    status: 'In Progress',
    riskScore: 52,
    riskLevel: 'Medium',
    flagReason: 'Sufficient deadline buffer (8 hrs), under regular monitoring.',
    evidence: [
      '8.0 hours remaining on SLA window',
      'Assigned Squad (Support) operating at healthy 42% capacity'
    ],
    suggestedAction: 'Keep under monitoring',
    actionType: 'Monitor',
    actionTaken: null,
    impactEstimate: 'Normal resolution within SLA'
  },
  {
    id: 'T105',
    problem: 'Password reset email link broken in Safari browser',
    category: 'Authentication',
    priority: 'Low',
    pendingHours: 1.0,
    deadlineHoursLeft: 24.0,
    assignedTeamId: 'team-d',
    status: 'Pending',
    riskScore: 22,
    riskLevel: 'Low',
    flagReason: 'Routine request with 24 hours deadline remaining.',
    evidence: [
      '24 hours deadline buffer',
      'Low urgency user impact'
    ],
    suggestedAction: 'Process in standard queue',
    actionType: 'Normal Queue',
    actionTaken: null,
    impactEstimate: 'Standard FIFO resolution'
  }
];

export const CATEGORY_METRICS = [
  { category: 'Payments', avgDelayHours: 4.8, breachRate: '28%', totalTickets: 420 },
  { category: 'Billing', avgDelayHours: 6.2, breachRate: '35%', totalTickets: 240 },
  { category: 'Infrastructure', avgDelayHours: 1.4, breachRate: '12%', totalTickets: 150 },
  { category: 'Authentication', avgDelayHours: 2.1, breachRate: '8%', totalTickets: 190 }
];

// NLP / LLM Pattern Summaries (Pillar 1)
export const AI_PATTERN_INSIGHTS = [
  {
    title: 'Recurring Webhook Latency Bottleneck',
    category: 'Payments',
    frequency: 'Recurring (High)',
    summary: '42% of payment delays stem from partner bank webhook retries exhausting connection pools during peak transaction windows (11:00 - 14:00).',
    tags: ['Webhook Exhaustion', 'UPI Latency', 'Connection Timeouts']
  },
  {
    title: 'Merchant Reconciliation Delays',
    category: 'Billing',
    frequency: 'Systemic Delay',
    summary: 'Billing and Refund tickets average 6.2h turnaround time because 68% require manual supervisor confirmation for transactions exceeding $1,000.',
    tags: ['Manual Audit Gap', 'High-Value Threshold', 'Refund Lag']
  },
  {
    title: 'Monday Deployment Outage Surge',
    category: 'Infrastructure',
    frequency: 'Predictable Spike',
    summary: 'DevOps squad experiences a 100% capacity saturation every Monday following morning cluster configuration updates.',
    tags: ['Cluster Deployments', 'Capacity Saturation', 'DevOps On-Call']
  }
];

// Bottleneck Forecasting & Anomaly Telemetry (Pillar 2)
export const HOURLY_WORKLOAD_FORECAST = [
  { hour: '09:00', incomingTickets: 45, squadCapacity: 75, anomalyStatus: 'Normal' },
  { hour: '11:00', incomingTickets: 80, squadCapacity: 75, anomalyStatus: 'Warning' },
  { hour: '13:00', incomingTickets: 125, squadCapacity: 75, anomalyStatus: 'Bottleneck Surge (Deficit: 50)' }, // Spike!
  { hour: '15:00', incomingTickets: 90, squadCapacity: 75, anomalyStatus: 'Elevated' },
  { hour: '17:00', incomingTickets: 55, squadCapacity: 75, anomalyStatus: 'Normal' }
];

// Baseline vs Proposed Solution Performance Scorecard (Pillar 5 & Deliverable 4)
export const PERFORMANCE_SCORECARD = {
  baseline: {
    slaComplianceRate: '68.5%',
    avgTurnaroundHours: '4.8h',
    overloadedSquadHours: '18.5h / week',
    monthlyBreaches: 94,
    productivityIndex: '62 / 100'
  },
  proposed: {
    slaComplianceRate: '96.2%',
    avgTurnaroundHours: '1.2h',
    overloadedSquadHours: '2.1h / week',
    monthlyBreaches: 8,
    productivityIndex: '94 / 100'
  },
  improvements: {
    slaGain: '+27.7%',
    timeReduction: '-75.0%',
    burnoutReduction: '-88.6%',
    breachReduction: '-91.5%',
    productivityGain: '+51.6%'
  }
};
