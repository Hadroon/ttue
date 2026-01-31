import { db } from "./index";
import { challenges, users, posts, comments } from "./schema";

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
    console.log('🌱 Seeding challenges with ideas and comments...');
    
    // First, ensure we have at least one user
    const [seedUser] = await db
      .insert(users)
      .values({
        username: 'seed_user',
        email: 'seed@earthforum.com',
        passwordHash: 'not-a-real-hash',
        displayName: 'Earth Forum Seed User',
        reputation: 100
      })
      .onConflictDoNothing()
      .returning();
    
    const userId = seedUser?.id || 1; // Use existing user if conflict
    console.log(`📝 Using user ID: ${userId}`);
    
    for (const challenge of seedChallenges) {
      const [insertedChallenge] = await db
        .insert(challenges)
        .values(challenge)
        .returning();
      
      console.log(`✅ Created challenge: ${insertedChallenge.title} (ID: ${insertedChallenge.id})`);
      
      // Add sample ideas (posts) for each challenge
      const ideaData = [
        {
          title: `Top Idea for ${insertedChallenge.title}`,
          content: `This is a highly voted proposal addressing the ${insertedChallenge.category.toLowerCase()} challenge. It includes comprehensive research, community feedback, and a detailed implementation roadmap.`,
          authorId: userId,
          challengeId: insertedChallenge.id,
          score: 45
        },
        {
          title: `Alternative Approach to ${insertedChallenge.title}`,
          content: `Here's a different perspective on solving this challenge with focus on cost-effectiveness and rapid deployment.`,
          authorId: userId,
          challengeId: insertedChallenge.id,
          score: 28
        }
      ];
      
      for (const idea of ideaData) {
        const [insertedPost] = await db
          .insert(posts)
          .values(idea)
          .returning();
        
        console.log(`  💡 Created idea: ${insertedPost.title} (ID: ${insertedPost.id}, Score: ${insertedPost.score})`);
        
        // Add sample comments to the top idea
        if (insertedPost.score >= 40) {
          const commentData = [
            {
              content: 'This is an excellent proposal! I especially appreciate the focus on implementation details.',
              postId: insertedPost.id,
              authorId: userId,
              score: 12
            },
            {
              content: 'Have you considered the budget implications? We should add a cost-benefit analysis.',
              postId: insertedPost.id,
              authorId: userId,
              score: 8
            },
            {
              content: 'Great work! This aligns well with our community priorities.',
              postId: insertedPost.id,
              authorId: userId,
              score: 5
            }
          ];
          
          for (const comment of commentData) {
            const [insertedComment] = await db
              .insert(comments)
              .values(comment)
              .returning();
            
            console.log(`    💬 Created comment (ID: ${insertedComment.id}, Score: ${insertedComment.score})`);
          }
        }
      }
    }
    
    console.log('✅ Challenges, ideas, and comments seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding challenges:', error);
    process.exit(1);
  }
}

seed();
