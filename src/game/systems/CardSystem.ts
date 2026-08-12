import { CARD_CONFIG } from '../config/constants';
import { PORTFOLIO_CONTENT, type CardId, type PortfolioCard } from '../config/content';

export class CardSystem {
  private readonly overlay: HTMLElement;
  private activeCard: HTMLElement | null = null;
  private closing = false;

  public constructor() {
    const overlay = document.querySelector<HTMLElement>('#card-overlay');
    if (!overlay) {
      throw new Error('Card overlay element is missing.');
    }
    this.overlay = overlay;
  }

  public open(id: CardId, onClosed: () => void): void {
    if (this.activeCard) return;

    const data = PORTFOLIO_CONTENT[id];
    const card = this.buildCard(data);
    this.activeCard = card;
    this.overlay.replaceChildren(card);
    this.overlay.classList.add('is-open');
    this.overlay.setAttribute('aria-hidden', 'false');

    const closeButton = card.querySelector<HTMLButtonElement>('.card-close');
    closeButton?.focus({ preventScroll: true });
    closeButton?.addEventListener('click', () => this.close(onClosed), { once: true });
  }

  public destroy(): void {
    this.overlay.classList.remove('is-open');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.replaceChildren();
    this.activeCard = null;
    this.closing = false;
  }

  private close(onClosed: () => void): void {
    if (!this.activeCard || this.closing) return;
    this.closing = true;
    const card = this.activeCard;
    card.classList.add('is-closing');

    let completed = false;
    const finish = (): void => {
      if (completed) return;
      completed = true;
      this.overlay.classList.remove('is-open');
      this.overlay.setAttribute('aria-hidden', 'true');
      this.overlay.replaceChildren();
      this.activeCard = null;
      this.closing = false;
      onClosed();
    };

    card.addEventListener('animationend', (event) => {
      if (event.target === card && card.classList.contains('is-closing')) finish();
    });
    window.setTimeout(finish, CARD_CONFIG.closeDurationMs + 120);
  }

  private buildCard(data: PortfolioCard): HTMLElement {
    const card = document.createElement('article');
    card.className = 'relic-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', data.title);

    const cornerA = document.createElement('i');
    cornerA.className = 'card-corner tl';
    const cornerB = document.createElement('i');
    cornerB.className = 'card-corner br';
    const close = document.createElement('button');
    close.className = 'card-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close card');
    close.textContent = '×';

    const index = this.textElement('p', 'card-index', data.index);
    const eyebrow = this.textElement('p', 'card-eyebrow', data.eyebrow);
    const title = this.textElement('h1', '', data.title);
    const subtitle = this.textElement('p', 'card-subtitle', data.subtitle);
    const rule = document.createElement('div');
    rule.className = 'card-rule';
    const body = document.createElement('div');
    body.className = 'card-body';
    data.body.forEach((paragraph) => body.append(this.textElement('p', '', paragraph)));

    card.append(cornerA, cornerB, close, index, eyebrow, title, subtitle, rule, body);

    if (data.tags) {
      const tags = document.createElement('div');
      tags.className = 'card-tags';
      data.tags.forEach((tag) => tags.append(this.textElement('span', '', tag)));
      card.append(tags);
    }

    if (data.links) {
      const links = document.createElement('nav');
      links.className = 'card-links';
      links.setAttribute('aria-label', 'Portfolio links');
      data.links.forEach((link) => {
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.textContent = link.label;
        if (link.href.startsWith('http')) {
          anchor.target = '_blank';
          anchor.rel = 'noreferrer';
        }
        links.append(anchor);
      });
      card.append(links);
    }
    return card;
  }

  private textElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }
}
