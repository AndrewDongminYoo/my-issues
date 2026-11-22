const paths = {
  block: <path d="m12 3 10 17H2zM12 9v5m0 2v1" />,
  closed: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  filter: (
    <>
      <path d="M3 7h8m5 0h5M3 17h3m5 0h10" />
      <circle cx="13" cy="7" r="2.5" />
      <circle cx="8" cy="17" r="2.5" />
    </>
  ),
  open: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  repo: <path d="M5 4h14v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 13h14M9 5v5l2-1 2 1V5" />,
  search: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m15 15 5 5" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
