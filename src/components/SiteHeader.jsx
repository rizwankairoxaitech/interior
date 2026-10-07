import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  ['Work', '#work'],
  ['Services', '#services'],
  ['Process', '#process'],
  ['Studio', '#studio'],
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className='site-header' data-scrolled={scrolled || menuOpen}>
      <a className='site-header__brand' href='#kitchen' onClick={closeMenu} aria-label='Atelier, back to the beginning'>
        <span>Atelier</span>
        <small>Interior architecture</small>
      </a>

      <button
        className='menu-toggle'
        type='button'
        aria-expanded={menuOpen}
        aria-controls='primary-navigation'
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden='true' />
        <span aria-hidden='true' />
      </button>

      <nav id='primary-navigation' className='site-header__nav-wrap' aria-label='Primary' data-open={menuOpen}>
        <ul className='site-header__nav'>
          {NAV_ITEMS.map(([label, href]) => (
            <li key={href}>
              <a href={href} onClick={closeMenu}>
                {label}
              </a>
            </li>
          ))}
        </ul>
        <a className='header-cta' href='#contact' onClick={closeMenu}>
          Start a project
          <span aria-hidden='true'>↗</span>
        </a>
      </nav>
    </header>
  );
}
