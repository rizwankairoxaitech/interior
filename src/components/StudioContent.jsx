import { useState } from 'react';
import { SHOWCASE_PIECE } from '../data/kitchenPieces.js';

const PROJECTS = [
  {
    title: 'The crafted kitchen',
    type: 'Joinery · Stone · Lighting',
    image: '/kitchen-frames/frame_0120.webp',
    alt: 'Olive-green kitchen with a marble island, glass pendants and timber flooring.',
    className: 'project-card--wide',
  },
  {
    title: 'A room for slow evenings',
    type: 'Living study · Furniture',
    image: '/images/atelier-living-room.webp',
    alt: 'Sunlit living room with a curved boucle sofa, travertine hearth and dark oak joinery.',
    className: 'project-card--compact',
  },
  {
    title: 'Stone and stillness',
    type: 'Bath study · Material detail',
    image: '/images/atelier-stone-bath.webp',
    alt: 'Warm limestone bathroom with a freestanding bath, ribbed oak and bronze fittings.',
    className: 'project-card--compact',
  },
  {
    title: 'The dining library',
    type: 'Joinery study · Styling',
    image: '/images/atelier-dining-library.webp',
    alt: 'Dark oak dining library with woven chairs, a paper pendant and full-height shelving.',
    className: 'project-card--wide',
  },
];

const PROCESS = [
  {
    name: 'Listen',
    title: 'A brief built from real life.',
    text: 'We start with the rituals, frustrations and ambitions that make the home yours—not a fixed house style.',
    detail: ['Measured survey', 'Spatial brief', 'Feasibility'],
  },
  {
    name: 'Compose',
    title: 'Space, light and movement align.',
    text: 'Layouts are tested as a whole so every threshold, view and piece of joinery earns its place.',
    detail: ['Concept layouts', 'Lighting intent', 'Material direction'],
  },
  {
    name: 'Resolve',
    title: 'Every junction is considered.',
    text: 'Detailed drawings and specifications turn the concept into a buildable, coordinated interior.',
    detail: ['Technical package', 'Bespoke joinery', 'Finishes schedule'],
  },
  {
    name: 'Deliver',
    title: 'One calm line to completion.',
    text: 'We stay close through procurement, site decisions and final styling until the room is ready to live in.',
    detail: ['Site coordination', 'Procurement', 'Installation'],
  },
];

const SERVICES = [
  {
    name: 'Interior architecture',
    short: 'Plan',
    image: '/images/atelier-living-room.webp',
    text: 'Spatial planning, architectural detailing and lighting that make the entire home feel inevitable.',
  },
  {
    name: 'Kitchens and joinery',
    short: 'Craft',
    image: '/kitchen-frames/frame_0120.webp',
    text: 'Bespoke kitchens, cabinetry and furniture designed down to the handle, edge and shadow gap.',
  },
  {
    name: 'Materials and atmosphere',
    short: 'Layer',
    image: '/images/atelier-stone-bath.webp',
    text: 'A tactile palette of stone, timber, metal, textile and light, sampled together before anything is signed off.',
  },
  {
    name: 'Delivery and styling',
    short: 'Finish',
    image: '/images/atelier-dining-library.webp',
    text: 'Procurement, site dialogue and the final edit of furniture, art and objects for a complete handover.',
  },
];

const PRINCIPLES = [
  {
    quote: 'A room should reveal itself slowly, then feel as though it has always belonged.',
    note: 'On character',
  },
  {
    quote: 'The quiet details matter most: where the light lands, how a door closes, what your hand touches.',
    note: 'On craft',
  },
  {
    quote: 'Luxury is not more. It is the right material, in the right place, resolved without noise.',
    note: 'On restraint',
  },
];

const MARQUEE_ITEMS = ['Spatial planning', 'Bespoke joinery', 'Material curation', 'Lighting', 'Site delivery', 'Final styling'];

function ArrowIcon({ direction = 'right' }) {
  const path = direction === 'left' ? 'M17 12H7m4-4-4 4 4 4' : 'M7 12h10m-4-4 4 4-4 4';
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
      <path d={path} fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

function ProjectGrid() {
  return (
    <section className='work section-shell' id='work' aria-labelledby='work-title'>
      <div className='section-heading' data-reveal>
        <p className='eyebrow'>Selected spaces</p>
        <h2 id='work-title'>A residential language of warmth, weight and quiet detail.</h2>
        <p className='section-heading__copy'>
          Concept studies showing how Atelier brings architecture, objects and atmosphere into one considered whole.
        </p>
      </div>

      <div className='project-grid'>
        {PROJECTS.map((project) => (
          <article className={['project-card', project.className].join(' ')} key={project.title} data-reveal>
            <figure className='project-card__media'>
              <img src={project.image} alt={project.alt} width='800' height='600' loading='lazy' />
            </figure>
            <div className='project-card__meta'>
              <h3>{project.title}</h3>
              <p>{project.type}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExpertiseMarquee() {
  return (
    <div className='marquee' aria-label={MARQUEE_ITEMS.join(', ')}>
      {[0, 1].map((copy) => (
        <div className='marquee__track' aria-hidden='true' key={copy}>
          {MARQUEE_ITEMS.map((item) => (
            <span key={item}>
              {item}
              <i aria-hidden='true'>✦</i>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function ProcessStack() {
  return (
    <section className='process section-shell section-shell--dark' id='process' aria-labelledby='process-title'>
      <div className='process__heading' data-reveal>
        <p className='eyebrow'>From first line to final object</p>
        <h2 id='process-title'>A clear process keeps ambitious work feeling calm.</h2>
      </div>

      <div className='process__stack'>
        {PROCESS.map((step, index) => (
          <article className='process-card' key={step.name} style={{ '--stack-index': index }}>
            <div className='process-card__body'>
              <p className='process-card__name'>{step.name}</p>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
            <ul className='process-card__detail' aria-label='Included in this phase'>
              {step.detail.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function ServicesAccordion() {
  const [active, setActive] = useState(0);

  return (
    <section className='services section-shell' id='services' aria-labelledby='services-title'>
      <div className='services__intro' data-reveal>
        <p className='eyebrow'>One studio, every layer</p>
        <h2 id='services-title'>Designed as a whole, never as disconnected parts.</h2>
        <p>Choose a capability to see how the studio carries the idea through.</p>
      </div>

      <div className='service-panels'>
        {SERVICES.map((service, index) => {
          const isActive = index === active;
          const panelId = `service-panel-${index}`;
          return (
            <article
              className='service-panel'
              data-active={isActive}
              key={service.name}
              onPointerEnter={() => setActive(index)}
            >
              <img src={service.image} alt='' width='800' height='600' loading='lazy' />
              <div className='service-panel__wash' aria-hidden='true' />
              <button
                type='button'
                aria-expanded={isActive}
                aria-controls={panelId}
                onClick={() => setActive(index)}
                onFocus={() => setActive(index)}
              >
                <span className='service-panel__short'>{service.short}</span>
                <span className='service-panel__name'>{service.name}</span>
              </button>
              <div className='service-panel__content' id={panelId} aria-hidden={!isActive}>
                <p>{service.text}</p>
                <a href='#contact' tabIndex={isActive ? 0 : -1}>
                  Discuss your project <span aria-hidden='true'>↗</span>
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PrinciplesCarousel() {
  const [active, setActive] = useState(0);
  const principle = PRINCIPLES[active];
  const move = (amount) => setActive((index) => (index + amount + PRINCIPLES.length) % PRINCIPLES.length);

  return (
    <section className='principles section-shell section-shell--dark' aria-labelledby='principles-title'>
      <div className='principles__top' data-reveal>
        <p className='eyebrow'>Studio principles</p>
        <p className='principles__count'>
          {String(active + 1).padStart(2, '0')} / {String(PRINCIPLES.length).padStart(2, '0')}
        </p>
      </div>

      <div className='principles__stage' aria-live='polite'>
        <blockquote key={principle.quote}>
          <p id='principles-title'>{principle.quote}</p>
          <footer>{principle.note}</footer>
        </blockquote>
        <div className='principles__controls'>
          <button type='button' onClick={() => move(-1)} aria-label='Previous principle'>
            <ArrowIcon direction='left' />
          </button>
          <button type='button' onClick={() => move(1)} aria-label='Next principle'>
            <ArrowIcon />
          </button>
        </div>
      </div>
    </section>
  );
}

function StudioStory() {
  return (
    <section className='studio-story section-shell' id='studio' aria-labelledby='studio-title'>
      <div className='studio-story__line' aria-hidden='true' />
      <div className='studio-story__statement' data-reveal>
        <p className='eyebrow'>Interiors with a point of view</p>
        <h2 id='studio-title'>We begin with how you live, then make every detail belong.</h2>
      </div>
      <div className='studio-story__copy' data-reveal>
        <p>
          Atelier is an interior architecture studio for thoughtful residential projects. We balance rigorous planning
          with tactile materials and a collected, unforced sense of home.
        </p>
        <p>
          From one defining room to a complete residence, the same team holds the thread from early concept through
          installation.
        </p>
        <a className='text-link' href='#services'>
          Explore the studio approach <span aria-hidden='true'>↓</span>
        </a>
      </div>
      {SHOWCASE_PIECE && (
        <figure className='studio-story__showcase'>
          <div className='studio-story__stage'>
            <img
              data-piece-showcase={SHOWCASE_PIECE.id}
              src={SHOWCASE_PIECE.showcase.src}
              alt={SHOWCASE_PIECE.showcase.alt}
              width={SHOWCASE_PIECE.showcase.width}
              height={SHOWCASE_PIECE.showcase.height}
            />
          </div>
          <figcaption>
            <span>{SHOWCASE_PIECE.number}</span> {SHOWCASE_PIECE.showcase.caption}
          </figcaption>
        </figure>
      )}
    </section>
  );
}

function FrequentlyAsked() {
  return (
    <section className='faq section-shell' aria-labelledby='faq-title'>
      <div className='faq__heading' data-reveal>
        <p className='eyebrow'>Before we begin</p>
        <h2 id='faq-title'>A few useful answers.</h2>
      </div>
      <div className='faq__items'>
        <details data-reveal>
          <summary>What kind of projects are a good fit?</summary>
          <p>
            Substantial renovations, new-build interiors and complete rooms where architecture, joinery, lighting and
            furnishing need to be considered together.
          </p>
        </details>
        <details data-reveal>
          <summary>Can Atelier work with our architect or contractor?</summary>
          <p>
            Yes. The studio can lead the interior scope or collaborate with an existing project team, with clear
            responsibilities agreed at the outset.
          </p>
        </details>
        <details data-reveal>
          <summary>When should we get in touch?</summary>
          <p>
            Early is best—ideally before layouts or services are fixed. That gives the interior architecture enough
            room to shape the project rather than simply decorate it.
          </p>
        </details>
      </div>
    </section>
  );
}

function InquirySection() {
  const [status, setStatus] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`Project inquiry from ${data.get('name')}`);
    const body = encodeURIComponent(
      `Name: ${data.get('name')}\nEmail: ${data.get('email')}\nProject: ${data.get('project')}\n\n${data.get('message')}`,
    );
    setStatus('Your email app should open with the project brief ready to send.');
    window.location.href = `mailto:hello@atelier.studio?subject=${subject}&body=${body}`;
  };

  return (
    <section className='contact section-shell' id='contact' aria-labelledby='contact-title'>
      <div className='contact__intro' data-reveal>
        <p className='eyebrow'>Begin a conversation</p>
        <h2 id='contact-title'>Tell us about the home you want to make.</h2>
        <p>Share the outline. We will reply with the right next step for your project.</p>
        <a href='mailto:hello@atelier.studio'>hello@atelier.studio</a>
      </div>

      <form className='inquiry-form' onSubmit={handleSubmit} data-reveal>
        <div className='form-field'>
          <label htmlFor='name'>Your name</label>
          <input id='name' name='name' autoComplete='name' required />
        </div>
        <div className='form-field'>
          <label htmlFor='email'>Email address</label>
          <input id='email' name='email' type='email' autoComplete='email' required />
        </div>
        <div className='form-field form-field--wide'>
          <label htmlFor='project'>Project type</label>
          <select id='project' name='project' defaultValue='' required>
            <option value='' disabled>
              Select one
            </option>
            <option>Complete residence</option>
            <option>Renovation</option>
            <option>Kitchen or principal room</option>
            <option>New-build interior</option>
          </select>
        </div>
        <div className='form-field form-field--wide'>
          <label htmlFor='message'>A little about the project</label>
          <textarea id='message' name='message' rows='4' required />
        </div>
        <div className='inquiry-form__footer'>
          <button className='primary-button' type='submit'>
            Send project brief <span aria-hidden='true'>↗</span>
          </button>
          <p className='form-status' role='status'>
            {status}
          </p>
        </div>
      </form>
    </section>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className='site-footer'>
      <div className='site-footer__brand'>
        <a href='#kitchen'>Atelier</a>
        <p>Interior architecture for considered homes.</p>
      </div>
      <div className='site-footer__nav'>
        <p>Explore</p>
        <a href='#work'>Work</a>
        <a href='#services'>Services</a>
        <a href='#process'>Process</a>
        <a href='#studio'>Studio</a>
      </div>
      <div className='site-footer__contact'>
        <p>Start a project</p>
        <a href='mailto:hello@atelier.studio'>hello@atelier.studio</a>
        <span>Residential interiors from concept to completion.</span>
      </div>
      <div className='site-footer__bottom'>
        <span>© {year} Atelier Interior Architecture</span>
        <a href='#kitchen'>Back to top ↑</a>
      </div>
    </footer>
  );
}

export default function StudioContent() {
  return (
    <>
      <StudioStory />
      <ProjectGrid />
      <ExpertiseMarquee />
      <ProcessStack />
      <ServicesAccordion />
      <PrinciplesCarousel />
      <FrequentlyAsked />
      <InquirySection />
      <SiteFooter />
    </>
  );
}
