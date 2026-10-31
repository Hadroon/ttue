import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../shared/components';

interface Step { id: string; icon: string; title: string; duration: string; desc: string; rows: { k: string; v: string }[]; }

@Component({
  selector: 'app-how-it-works',
  imports: [RouterLink, Header],
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.css'
})
export class HowItWorks {
  steps: Step[] = [
    { id: 'challenges-ideas', icon: '💡', title: 'Challenges & Ideas', duration: '', desc: 'Join policy challenges, share innovative ideas, and collaborate on solutions to pressing problems.', rows: [
      { k: 'Inputs', v: 'A real-world problem, a civic concern, or a fresh idea for change' },
      { k: 'Platform checks', v: 'Community moderation, duplicate detection, scope validation' },
      { k: 'Outputs', v: 'A challenge or idea posted to the platform, open for collaboration' }] },
    { id: 'collaborative-drafting', icon: '📝', title: 'Collaborative Drafting', duration: '1–7 days', desc: 'Build the Blueprint. Start with a guided template or import a draft. Cite evidence and refine the logic in a transparent, open-source space.', rows: [
      { k: 'Inputs', v: 'Community research, guided templates, imported drafts' },
      { k: 'Platform checks', v: 'Evidence citations, duplicate detection, legality scope' },
      { k: 'Outputs', v: 'Shareable draft with inline citations and impact checklist' }] },
    { id: 'wisdom-check', icon: '🧠', title: 'Wisdom Check', duration: '3–10 days', desc: 'Verify the Path. Trusted Builders and Caretakers annotate drafts for feasibility, risks, and social impact, ensuring our solutions are grounded in reality.', rows: [
      { k: 'Who', v: 'Rotating pool of domain experts with public disclosures; randomized assignment' },
      { k: 'Checks', v: 'Evidence validation, conflict-of-interest flags, credential verification' },
      { k: 'Outputs', v: 'Feasibility report, risk register, social impact assessment, budget estimate' }] },
    { id: 'civic-refinement', icon: '🗳️', title: 'Civic Refinement', duration: '5–14 days', desc: 'Unite through Logic. Our reputation system and civility tools help the most effective ideas rise, filtering out the noise of old political friction.', rows: [
      { k: 'Signals', v: 'Reputation weighting, rate-limits for noise, down-ranking of uncivil posts' },
      { k: 'Outputs', v: 'Consolidated draft + set of vetted alternatives' }] },
    { id: 'formulate-action', icon: '📜', title: 'Formulate Action', duration: '', desc: 'Finalize the Plan. Once consensus is reached, proposals crystallize into actionable blueprints — high-quality solutions ready for our civilization to adopt.', rows: [
      { k: 'Gate', v: 'Support + review thresholds achieved' },
      { k: 'Outputs', v: 'Actionable blueprint, voting brief, implementation tracker' },
      { k: 'Aftercare', v: 'Post-adoption audit and metrics reporting' }] },
    { id: 'collective-resonance', icon: '📣', title: 'Collective Resonance', duration: '', desc: 'Drive the Change. We move beyond the platform. Using the weight of our community, users leverage social media and direct outreach to deliver blueprints to leaders, ensuring they are implemented.', rows: [
      { k: 'Inputs', v: 'Finalized blueprint, community weight and momentum' },
      { k: 'Outputs', v: 'Blueprint delivered to decision-makers, tracked for real-world implementation' }] },
  ];

  faqs = [
    { q: 'Who can participate?', a: 'Any verified citizen. Organizations can co-sponsor with disclosure. Every verified voice has equal standing in the process.' },
    { q: 'How are experts chosen for the Wisdom Check?', a: 'A rotating pool within domain expertise; assignments are randomized and all disclosures are public to prevent conflicts of interest.' },
    { q: 'What happens after Collective Resonance?', a: 'The community tracks real-world adoption of blueprints. Post-adoption audits and metrics reporting keep leaders accountable.' },
    { q: 'What counts as support?', a: 'Weighted by verification and reputation to reward constructive participation — not volume.' },
  ];

  // Plain "#id" links resolve against <base href="/"> and would leave the page, so scroll in place.
  jumpTo(event: Event, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
