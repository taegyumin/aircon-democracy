import { TOKEN } from '../lib/tokens';
import { PlaceIcon } from './Icons';
import { brandFor } from '../lib/brands';
import type { PlaceType } from '../lib/places';

interface Props {
  name: string;
  type: PlaceType;
  size?: number;
  color?: string;
}

export function PlaceTypeIcon({ name, type, size = 20, color = TOKEN.text2 }: Props) {
  const brand = brandFor(name);
  if (brand) {
    return (
      <img
        src={brand.iconUrl}
        alt=""
        width={size}
        height={size}
        style={{
          display: 'block',
          width: size,
          height: size,
          objectFit: 'contain',
          objectPosition: 'center',
        }}
      />
    );
  }
  return <PlaceIcon type={type} size={size} color={color} />;
}
