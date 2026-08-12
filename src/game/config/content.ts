export type CardId = 'CARD_01' | 'CARD_02' | 'CARD_03';

export interface PortfolioLink {
  label: string;
  href: string;
}

export interface PortfolioCard {
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string[];
  tags?: string[];
  links?: PortfolioLink[];
  index: string;
}

export const PORTFOLIO_CONTENT: Record<CardId, PortfolioCard> = {
  CARD_01: {
    index: '01 / SIGNAL RECOVERED',
    eyebrow: 'ARCHIVE TAPE',
    title: 'TOTO / WENTAO',
    subtitle: 'A maker somewhere between machines and strange little worlds.',
    body: [
      'I build physical systems, interactive software, and the connective tissue between them.',
      'This copy is deliberately replaceable: edit content.ts without touching any scene logic.',
    ],
    tags: ['ROBOTICS', 'EMBEDDED SYSTEMS', 'CREATIVE CODING'],
  },
  CARD_02: {
    index: '02 / PRESSURE LOG',
    eyebrow: 'FIELD RECORD',
    title: 'PROJECT / EXPERIENCE',
    subtitle: 'Things made by testing the weak points.',
    body: [
      'Selected work will live here: robots, tools, experiments, and the lessons hidden inside each failure.',
      'Replace this placeholder with concise project stories and direct repository links.',
    ],
    tags: ['SYSTEM DESIGN', 'PROTOTYPING', 'FIELD TESTING'],
  },
  CARD_03: {
    index: '03 / END OF LINE',
    eyebrow: 'GILDED RELIC',
    title: 'THANKS FOR EXPLORING',
    subtitle: 'The dark continues. The links do not have to.',
    body: [
      'You reached the end of this small world. The passages below lead somewhere more practical.',
    ],
    links: [
      { label: 'GITHUB', href: 'https://github.com/' },
      { label: 'EMAIL', href: 'mailto:hello@example.com' },
      { label: 'RESUME / PORTFOLIO', href: '#' },
    ],
  },
};
