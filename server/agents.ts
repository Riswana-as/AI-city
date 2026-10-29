import { DistrictId } from './types.js';

export interface AgentProfile {
  id: string; // e.g., 'research-0'
  index: number; // 0..41
  dept: DistrictId;
  deptName: string;
  deptGoal: string;
  name: string;
  role: string;
  trait: string;
  roleIndex: number; // 0..5
  systemPrompt: string;
}

export const NAMES: readonly string[] = [
  'Mako', 'Lumi', 'Nova', 'Zara', 'Kiyo', 'Orbi',
  'Pixel', 'Echo', 'Atlas', 'Juno', 'Rex', 'Sol',
  'Vega', 'Ziggy', 'Bolt', 'Cleo', 'Dash', 'Ember',
  'Fynn', 'Gizmo', 'Halo', 'Iris', 'Jett', 'Kai',
  'Luna', 'Milo', 'Nico', 'Opal', 'Pip', 'Quill',
  'Rio', 'Sage', 'Tilt', 'Umi', 'Vox', 'Wren',
  'Xeno', 'Yuki', 'Zed', 'Ada', 'Bex', 'Cog'
];

export const TRAITS: readonly string[] = [
  'curious',
  'meticulous',
  'calm',
  'bold',
  'playful',
  'skeptical'
];

export interface DistrictMeta {
  id: DistrictId;
  name: string;
  goal: string;
  roles: string[];
}

export const DISTRICT_DEFS: DistrictMeta[] = [
  {
    id: 'command',
    name: 'Command center',
    goal: 'Plan, assign and combine results from every district.',
    roles: [
      'Coordinator',
      'Task router',
      'Progress monitor',
      'Resource planner',
      'Quality liaison',
      'Briefing lead'
    ]
  },
  {
    id: 'research',
    name: 'Research institute',
    goal: 'Turn questions into verified findings.',
    roles: [
      'Research manager',
      'Web researcher',
      'Data analyst',
      'Competitor analyst',
      'Fact checker',
      'Research synthesizer'
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing district',
    goal: 'Turn audience insight into campaigns.',
    roles: [
      'Marketing manager',
      'Audience researcher',
      'Campaign planner',
      'Performance analyst',
      'Strategy reviewer',
      'Campaign synthesizer'
    ]
  },
  {
    id: 'design',
    name: 'Design studio',
    goal: 'Shape concepts into reviewed visuals.',
    roles: [
      'Design lead',
      'UI designer',
      'Brand designer',
      '3D artist',
      'Design reviewer',
      'Handoff coordinator'
    ]
  },
  {
    id: 'finance',
    name: 'Finance tower',
    goal: 'Produce validated financial analysis.',
    roles: [
      'Finance lead',
      'Financial analyst',
      'Forecast modeler',
      'Budget planner',
      'Validator',
      'Report compiler'
    ]
  },
  {
    id: 'cost',
    name: 'Cost analysis center',
    goal: 'Understand costs, margins and scenarios.',
    roles: [
      'Cost lead',
      'Expense analyst',
      'Margin modeler',
      'Scenario planner',
      'Cost validator',
      'Cost summarizer'
    ]
  },
  {
    id: 'content',
    name: 'Content factory',
    goal: 'Move briefs to approved content.',
    roles: [
      'Content manager',
      'Brief researcher',
      'Writer',
      'Script writer',
      'Editor',
      'Delivery coordinator'
    ]
  }
];

export const AGENT_CATALOG: AgentProfile[] = [];
export const AGENTS_BY_ID: Record<string, AgentProfile> = {};

let botCounter = 0;
for (const dept of DISTRICT_DEFS) {
  for (let j = 0; j < 6; j++) {
    const n = botCounter;
    const name = NAMES[n];
    const role = dept.roles[j];
    const trait = TRAITS[(n * 5 + j) % 6];
    const id = `${dept.id}-${j}`;

    const systemPrompt = `You are ${name}, the ${role} of the "${dept.name}" district in AI City.
Your personality trait is "${trait}".
Your district's objective is: "${dept.goal}".
There are 42 specialized autonomous agents across 7 districts in AI City who collaborate in real time.
When responding to users or executing department tasks:
1. Stay strictly in character as ${name} (${role}). Reflect your personality trait (${trait}) naturally without being caricature.
2. Provide precise, actionable domain expertise tailored to your specialty (${role}).
3. When addressing data, strategies, or deliverables, provide concrete numbers, frameworks, and sharp recommendations.
4. Keep chat answers clear, engaging, and professional (like an elite AI specialist colleague).`;

    const profile: AgentProfile = {
      id,
      index: n,
      dept: dept.id,
      deptName: dept.name,
      deptGoal: dept.goal,
      name,
      role,
      trait,
      roleIndex: j,
      systemPrompt
    };

    AGENT_CATALOG.push(profile);
    AGENTS_BY_ID[id] = profile;
    botCounter++;
  }
}

export function getAgentById(id: string): AgentProfile | undefined {
  return AGENTS_BY_ID[id];
}

export function getDistrictAgents(dept: DistrictId): AgentProfile[] {
  return AGENT_CATALOG.filter(a => a.dept === dept);
}
