import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAiSuggestions } from '../../api/ai';
import { buildPlanContext } from '../aiContext';
import { generatePlanFromTemplate } from '../../domain/templates';
import type { Plan } from '../../domain/plan';

afterEach(() => vi.unstubAllGlobals());

const SECRETS = {
  title: 'Meera Sharma & Kabir Rao Wedding',
  note: 'Grandma needs a wheelchair ramp near gate 2',
  taskNote: 'Call uncle about the loan',
  vendorName: 'Shree Ganesh Caterers',
  phone: '+91 98765 43210',
  email: 'meera.sharma@example.com',
  expenseNote: 'Paid in cash to Ramesh',
  eventDate: '2027-03-14',
};

function privatePlan(): Plan {
  const plan = generatePlanFromTemplate({
    id: 'privacy',
    type: 'wedding',
    title: SECRETS.title,
    eventDate: SECRETS.eventDate,
    city: 'Pune',
    guestEstimate: 180,
    budgetTotalPaise: 12_50_000_00,
    preferences: {
      themeWords: ['marigold'],
      dietFocus: ['veg'],
      customs: [],
      avoidColours: [],
      notes: SECRETS.note,
    },
  });
  plan.tasks[0] = { ...plan.tasks[0], notes: SECRETS.taskNote };
  plan.vendors = [
    {
      id: 'v1',
      categoryKey: 'catering',
      name: SECRETS.vendorName,
      phone: SECRETS.phone,
      email: SECRETS.email,
      status: 'shortlisted',
      notes: SECRETS.note,
    },
  ];
  plan.expenses = [
    {
      id: 'e1',
      categoryId: plan.budgetCategories[0].id,
      description: 'Advance',
      amountPaise: 1000,
      kind: 'paid',
      spentOn: '2026-12-01',
      note: SECRETS.expenseNote,
    },
  ];
  return plan;
}

describe('AI request privacy (AI_SCHEMAS.md §2)', () => {
  it('never sends notes, names, emails, phone numbers, vendor names or exact dates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ready',
          items: [],
          assumptions: [],
          warnings: [],
          message: null,
          usage: { inputTokens: 0, outputTokens: 0 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const plan = privatePlan();
    await requestAiSuggestions('plan.generate', buildPlanContext(plan, '2026-10-31'));

    const body = String(fetchMock.mock.calls[0][1].body);
    for (const value of Object.values(SECRETS)) {
      expect(body).not.toContain(value);
    }
    expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no exact dates of any kind
    expect(body).not.toMatch(/@|\+91/);
    // What is allowed: the month, not the day.
    expect(JSON.parse(body).context.month).toBe('2027-03');
  });
});
