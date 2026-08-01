/**
 * Calendar sheet with a send arrow — planning plus publishing, which is what
 * this tool does.
 */
export function ZernioIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 25 25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-sanity-icon="zernio"
    >
      <rect x="3.5" y="5.5" width="14" height="14" rx="2.5" />
      <path d="M3.5 9.5h14M7.5 3.5v3M13.5 3.5v3" />
      <path d="M12.5 15.5l9-4.5-3 9-2-3z" fill="currentColor" stroke="none" />
    </svg>
  )
}
