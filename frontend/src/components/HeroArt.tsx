import Spot, { type SpotName } from './Spots';

/* A large signature illustration for a sub-page hero. */
export default function HeroArt({ name }: { name: SpotName }) {
  return (
    <div className="hero-art" aria-hidden="true">
      <Spot name={name} />
    </div>
  );
}
