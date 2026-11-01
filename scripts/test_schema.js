const { PlanSchema } = require('./web/src/domain/plan.ts');

const celebrationFunctions = [
  {
    id: 'fn-wedding',
    name: 'Wedding',
    date: '2027-02-14',
    startTime: '10:00',
    endTime: '15:00',
    position: 1
  }
];

const celebrationScheduleItems = [
  {
    id: 'sched-w-1',
    functionId: 'fn-wedding',
    startTime: '10:00',
    durationMin: 45,
    title: 'Baraat arrival',
    notes: 'Procession at grand gate, dhol troupe and milni scarves ready',
    position: 1
  }
];

const testPlan = {
  id: 'plan-ananya-rohan',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  event: {
    type: 'wedding',
    title: 'Ananya & Rohan',
    eventDate: '2027-02-14',
    timezone: 'Asia/Kolkata',
    city: 'Jaipur',
    guestEstimate: 250,
    budgetTotalPaise: 180000000,
    currency: 'INR',
    preferences: {
      themeWords: [],
      dietFocus: [],
      customs: [],
      avoidColours: [],
      notes: ''
    }
  },
  functions: celebrationFunctions,
  budgetCategories: [],
  expenses: [],
  tasks: [],
  vendors: [],
  quotes: [],
  guests: null,
  scheduleItems: celebrationScheduleItems,
  ideas: []
};

const res = PlanSchema.safeParse(testPlan);
console.log("SafeParse result:", res.success, res.error ? JSON.stringify(res.error.issues, null, 2) : 'OK');

