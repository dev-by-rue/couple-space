import { useId } from "react";

type LogoProps = React.SVGAttributes<SVGSVGElement>;

/**
 * The Couple Space mark: two speech bubbles with a heart cut out.
 *
 * @remarks
 * Same paths as `public/icons/icon.svg`, without the background tile. The
 * mask id comes from `useId` so two logos on one page don't share a mask.
 * Decorative by default; the wrapping link or heading gives the name.
 */
export function Logo(props: Readonly<LogoProps>) {
  const maskId = useId();

  return (
    <svg viewBox="40 60 360 330" aria-hidden="true" {...props}>
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="440" height="440" fill="white" />
          <path
            d="M247 183L205 146C186 129 190 101 210 90C223 83 239 88 247 102C255 88 271 83 284 90C304 101 308 129 289 146L247 183Z"
            fill="black"
          />
        </mask>
      </defs>
      <g transform="translate(-9.3 45)">
        <g mask={`url(#${maskId})`}>
          <path
            d="M65 173C65 123.3 105.3 83 155 83H232C281.7 83 322 123.3 322 173V193C322 242.7 281.7 283 232 283H172L105 338L119 281C88.1 274.5 65 247.1 65 214V173Z"
            fill="#3E8A8A"
            transform="translate(25.2928 13.6192) scale(.8976)"
          />
          <path
            d="M375 123C375 73.3 334.7 33 285 33H208C158.3 33 118 73.3 118 123V143C118 192.7 158.3 233 208 233H268L335 288L321 231C351.9 224.5 375 197.1 375 164V123Z"
            fill="#C5D4C8"
          />
        </g>
      </g>
    </svg>
  );
}
