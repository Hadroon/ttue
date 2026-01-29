import { db } from "./index";
import { challenges } from "./schema";

const seedChallenges = [
  {
    category: 'Environment',
    title: 'Climate Adaptation Strategies',
    description: 'Develop comprehensive policy frameworks for cities to adapt to climate change impacts including flooding, heat waves, and extreme weather events.',
    urgency: 'Critical',
    participantCount: 347,
    rewardPool: '$50,000',
    deadline: new Date('2025-12-15'),
    tags: ['climate', 'adaptation', 'urban-planning', 'emergency-response'],
    votes: 124
  },
  {
    category: 'Technology',
    title: 'Digital Equity and Access',
    description: 'Create policies ensuring equitable access to digital infrastructure, devices, and digital literacy programs for underserved communities.',
    urgency: 'High',
    participantCount: 892,
    rewardPool: '$25,000',
    deadline: new Date('2025-11-30'),
    tags: ['digital-divide', 'accessibility', 'education', 'infrastructure'],
    votes: 85
  },
  {
    category: 'Housing',
    title: 'Affordable Housing Innovation',
    description: 'Design innovative policy solutions to address the affordable housing crisis while promoting sustainable development.',
    urgency: 'Critical',
    participantCount: 1456,
    rewardPool: '$75,000',
    deadline: new Date('2026-01-31'),
    tags: ['housing', 'affordability', 'zoning', 'sustainability'],
    votes: 203
  }
];

async function seed() {
  try {
    console.log('🌱 Seeding challenges...');
    
    for (const challenge of seedChallenges) {
      const [inserted] = await db
        .insert(challenges)
        .values(challenge)
        .returning();
      
      console.log(`✅ Created challenge: ${inserted.title} (ID: ${inserted.id})`);
    }
    
    console.log('✅ Challenges seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding challenges:', error);
    process.exit(1);
  }
}

seed();
