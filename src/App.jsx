import { useRef } from 'react';
import KitchenScrollExperience from './components/KitchenScrollExperience.jsx';
import RoomPieces from './components/RoomPieces.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import StudioContent from './components/StudioContent.jsx';
import { useStudioMotion } from './hooks/useStudioMotion.js';

export default function App() {
  const pageRef = useRef(null);

  useStudioMotion(pageRef);

  return (
    <div ref={pageRef} className='site-shell'>
      <a className='skip-link' href='#main-content'>
        Skip to main content
      </a>

      <SiteHeader />

      <main id='main-content' tabIndex='-1'>
        <KitchenScrollExperience
          headingLevel={1}
          heading={'Atelier interior architecture. Calm, characterful homes shaped around the way you live.'}
          intro={{ word: 'ATELIER', tagline: 'Interior architecture', cue: 'Scroll to enter' }}
          scrollLength={520}
          mobileScrollLength={390}
          smoothing={0.075}
          skipHref='#studio'
          skipLabel='Skip the reveal'
        />
        <RoomPieces />
        <StudioContent />
      </main>
    </div>
  );
}
